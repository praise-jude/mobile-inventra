// Direct-Supabase equivalent of Inventra/lib/actions/sales.ts's Server
// Actions. See lib/actions/products.ts's header comment for why this is a
// direct client write rather than a bearer-token API route — the one
// meaningful difference from web is documented below on recordSale.
import { logAudit } from '@/lib/actions/audit';
import { isManagerRole } from '@/lib/roles';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { PaymentMethod, Profile } from '@/types/database';

function requireSalesRole(profile: Profile) {
  if (profile.role === 'warehouse') throw new Error("Warehouse accounts can't record sales.");
}

export interface SaleLineInput {
  productId: string;
  qty: number;
  discountPct: number;
}

export interface RecordSaleInput {
  customerId?: string;
  warehouseId?: string;
  items: SaleLineInput[];
  paymentMethod: PaymentMethod;
  notes?: string;
}

// Re-derives every money figure from freshly-fetched product prices/stock
// right before insert — same "never trust client totals" rule web's
// recordSale documents, just run on-device instead of in a Next.js Server
// Action. The one gap vs. web: there's no second, independent server-side
// re-check after this — a race between two staff selling the last unit at
// the same moment could both pass this check. Accepted for v1, matching how
// every other mobile write already relies on this client-side-check +
// RLS-scoping pattern (see products.ts/inventory.ts); revisit only if
// overselling actually shows up in practice.
export async function recordSale(input: RecordSaleInput): Promise<string> {
  const profile = await requireProfile();
  requireSalesRole(profile);

  if (input.items.length === 0) throw new Error('Add at least one product to the sale.');
  for (const item of input.items) {
    if (item.qty <= 0) throw new Error('Quantity must be greater than zero.');
    if (item.discountPct < 0 || item.discountPct > 100) throw new Error('Discount must be between 0 and 100%.');
  }

  const productIds = input.items.map((i) => i.productId);
  const [{ data: products, error: prodError }, { data: org, error: orgError }] = await Promise.all([
    supabase.from('products').select('id, name, sell_price, qty_on_hand, warehouse_id, is_active').in('id', productIds),
    supabase.from('organizations').select('tax_rate').eq('id', profile.org_id).single(),
  ]);
  if (prodError || !products) throw new Error('Could not load the selected products.');
  if (orgError || !org) throw new Error('Could not load tax settings.');

  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  let discountAmount = 0;
  const lines: { productId: string; qty: number; warehouseId: string | null; unitPrice: number }[] = [];

  for (const item of input.items) {
    const product = productById.get(item.productId);
    if (!product) throw new Error('One of the selected products no longer exists.');
    if (!product.is_active) throw new Error(`"${product.name}" is inactive and can't be sold — reactivate it first.`);
    if (item.qty > product.qty_on_hand) {
      throw new Error(`Only ${product.qty_on_hand} of "${product.name}" in stock.`);
    }
    const lineSubtotal = Number(product.sell_price) * item.qty;
    const lineDiscount = lineSubtotal * (item.discountPct / 100);
    const lineTotal = lineSubtotal - lineDiscount;
    subtotal += lineSubtotal;
    discountAmount += lineDiscount;
    lines.push({
      productId: item.productId,
      qty: item.qty,
      warehouseId: product.warehouse_id,
      unitPrice: item.qty > 0 ? lineTotal / item.qty : 0,
    });
  }

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (Number(org.tax_rate) / 100);
  const total = taxableAmount + taxAmount;
  if (total <= 0) throw new Error('Sale total must be greater than zero.');

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      org_id: profile.org_id,
      customer_id: input.customerId || null,
      walk_in_name: null,
      warehouse_id: input.warehouseId || null,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      notes: input.notes?.trim() || null,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (saleError || !sale) throw new Error('Could not record the sale.');

  const { error: payError } = await supabase
    .from('sale_payments')
    .insert({ org_id: profile.org_id, sale_id: sale.id, method: input.paymentMethod, amount: total });
  if (payError) throw new Error("Could not record the sale's payment.");

  const { error: movementError } = await supabase.from('stock_movements').insert(
    lines.map((l) => ({
      org_id: profile.org_id,
      product_id: l.productId,
      warehouse_id: l.warehouseId,
      type: 'sale' as const,
      qty_delta: -l.qty,
      unit_price: l.unitPrice,
      reason: null,
      adjustment_type: null,
      notes: null,
      sale_id: sale.id,
      created_by: profile.id,
    })),
  );
  if (movementError) throw new Error('Could not update stock for this sale.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'sale.created',
    module: 'Sales',
    entityType: 'sale',
    entityId: sale.id as string,
    entityLabel: `Sale of ${lines.length} item${lines.length === 1 ? '' : 's'} — ${total.toFixed(2)}`,
    newValue: { total, subtotal, discountAmount, taxAmount, itemCount: lines.length, paymentMethod: input.paymentMethod },
  });

  return sale.id as string;
}

export interface UpdateSaleInput {
  notes?: string;
  paymentMethod?: PaymentMethod;
}

export async function updateSale(id: string, input: UpdateSaleInput): Promise<void> {
  const profile = await requireProfile();

  const { data: updated, error: saleError } = await supabase
    .from('sales')
    .update({ notes: input.notes?.trim() || null })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (saleError) throw new Error('Could not update the sale.');
  if (!updated) throw new Error("Sale not found, or you don't have permission to edit it.");

  if (input.paymentMethod) {
    const { data: payments, error: payFetchError } = await supabase.from('sale_payments').select('id').eq('sale_id', id);
    if (payFetchError) throw new Error("Could not update the sale's payment method.");
    if ((payments ?? []).length === 1) {
      const { error: payError } = await supabase
        .from('sale_payments')
        .update({ method: input.paymentMethod })
        .eq('id', payments![0].id);
      if (payError) throw new Error("Could not update the sale's payment method.");
    }
  }

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'sale.updated',
    module: 'Sales',
    entityType: 'sale',
    entityId: id,
    newValue: { paymentMethod: input.paymentMethod ?? null },
  });
}

// Deleting each stock_movements row fires the DB's reverse_stock_movement
// trigger, restoring qty_on_hand — no manual compensating entry needed. The
// sales row delete then cascades to sale_payments.
export async function deleteSale(id: string): Promise<void> {
  const profile = await requireProfile();
  if (!isManagerRole(profile.role)) {
    throw new Error('Only an owner, admin, or manager can delete a sale.');
  }

  const { data: sale, error: saleError } = await supabase.from('sales').select('id, total').eq('id', id).maybeSingle();
  if (saleError) throw new Error('Could not load this sale.');
  if (!sale) throw new Error('Sale not found.');

  const { error: movementsError } = await supabase.from('stock_movements').delete().eq('sale_id', id);
  if (movementsError) throw new Error("Could not reverse this sale's stock impact.");

  const { error: deleteError } = await supabase.from('sales').delete().eq('id', id);
  if (deleteError) throw new Error('Could not delete the sale.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'sale.voided',
    module: 'Sales',
    entityType: 'sale',
    entityId: id,
    newValue: { total: sale.total },
  });
}
