// Direct-Supabase equivalent of Inventra/lib/actions/sales.ts's Server
// Actions. See lib/actions/products.ts's header comment for why this is a
// direct client write rather than a bearer-token API route — the one
// meaningful difference from web is documented below on recordSale.
import { logAudit } from '@/lib/actions/audit';
import { createApprovalRequest, getApprovalSettings } from '@/lib/approval-service';
import { requirePermission } from '@/lib/permissions';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { PaymentMethod, Profile, UserRole } from '@/types/database';

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

interface ComputedSale {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  maxDiscountPct: number;
  lines: { productId: string; qty: number; warehouseId: string | null; unitPrice: number }[];
}

async function computeSale(orgId: string, input: RecordSaleInput): Promise<ComputedSale> {
  if (input.items.length === 0) throw new Error('Add at least one product to the sale.');
  for (const item of input.items) {
    if (item.qty <= 0) throw new Error('Quantity must be greater than zero.');
    if (item.discountPct < 0 || item.discountPct > 100) throw new Error('Discount must be between 0 and 100%.');
  }

  const productIds = input.items.map((i) => i.productId);
  const [{ data: products, error: prodError }, { data: org, error: orgError }] = await Promise.all([
    supabase.from('products').select('id, name, sell_price, qty_on_hand, warehouse_id, is_active').in('id', productIds),
    supabase.from('organizations').select('tax_rate').eq('id', orgId).single(),
  ]);
  if (prodError || !products) throw new Error('Could not load the selected products.');
  if (orgError || !org) throw new Error('Could not load tax settings.');

  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  let discountAmount = 0;
  let maxDiscountPct = 0;
  const lines: ComputedSale['lines'] = [];

  for (const item of input.items) {
    const product = productById.get(item.productId);
    if (!product) throw new Error('One of the selected products no longer exists.');
    if (!product.is_active) throw new Error(`"${product.name}" is inactive and can't be sold — reactivate it first.`);
    if (item.qty > product.qty_on_hand) {
      throw new Error(`Only ${product.qty_on_hand} of "${product.name}" in stock.`);
    }
    maxDiscountPct = Math.max(maxDiscountPct, item.discountPct);
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

  return { subtotal, discountAmount, taxAmount, total, maxDiscountPct, lines };
}

// The actual writes — shared by the immediate path (recordSale, no approval
// needed) and the approved-request path (approvals.ts, run attributed to the
// original requester once a manager approves it).
export async function performRecordSale(
  ctx: { orgId: string; userId: string; role: UserRole; actorName: string },
  input: RecordSaleInput,
  computed: ComputedSale,
): Promise<string> {
  const { orgId, userId, role, actorName } = ctx;
  const { subtotal, discountAmount, taxAmount, total, lines } = computed;

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      org_id: orgId,
      customer_id: input.customerId || null,
      walk_in_name: null,
      warehouse_id: input.warehouseId || null,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      notes: input.notes?.trim() || null,
      created_by: userId,
    })
    .select('id')
    .single();
  if (saleError || !sale) throw new Error('Could not record the sale.');

  const { error: payError } = await supabase
    .from('sale_payments')
    .insert({ org_id: orgId, sale_id: sale.id, method: input.paymentMethod, amount: total });
  if (payError) throw new Error("Could not record the sale's payment.");

  const { error: movementError } = await supabase.from('stock_movements').insert(
    lines.map((l) => ({
      org_id: orgId,
      product_id: l.productId,
      warehouse_id: l.warehouseId,
      type: 'sale' as const,
      qty_delta: -l.qty,
      unit_price: l.unitPrice,
      reason: null,
      adjustment_type: null,
      notes: null,
      sale_id: sale.id,
      created_by: userId,
    })),
  );
  if (movementError) throw new Error('Could not update stock for this sale.');

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: 'sale.created',
    module: 'Sales',
    entityType: 'sale',
    entityId: sale.id as string,
    entityLabel: `Sale of ${lines.length} item${lines.length === 1 ? '' : 's'} — ${total.toFixed(2)}`,
    newValue: { total, subtotal, discountAmount, taxAmount, itemCount: lines.length, paymentMethod: input.paymentMethod },
  });

  return sale.id as string;
}

export type RecordSaleResult =
  | { status: 'created'; saleId: string }
  | { status: 'pending_approval'; approvalRequestId: string };

export async function recordSale(input: RecordSaleInput): Promise<RecordSaleResult> {
  const profile = await requireProfile();
  requireSalesRole(profile);
  await requirePermission('sales', 'create');

  const computed = await computeSale(profile.org_id, input);

  const settings = await getApprovalSettings(profile.org_id);
  const needsApproval =
    !!settings?.discount_approval_enabled && computed.maxDiscountPct > Number(settings.discount_threshold_pct);

  const ctx = { orgId: profile.org_id, userId: profile.id, role: profile.role, actorName: `${profile.first_name} ${profile.last_name}` };

  if (needsApproval) {
    const requestId = await createApprovalRequest({
      orgId: profile.org_id,
      entityType: 'discount',
      requestedBy: profile.id,
      payload: { input, computed },
      notifyTitle: 'Discount needs approval',
      notifyBody: `${ctx.actorName} wants to apply a ${computed.maxDiscountPct}% discount on a sale of ${computed.total.toFixed(2)}.`,
    });
    return { status: 'pending_approval', approvalRequestId: requestId };
  }

  const saleId = await performRecordSale(ctx, input, computed);
  return { status: 'created', saleId };
}

export interface UpdateSaleInput {
  notes?: string;
  paymentMethod?: PaymentMethod;
}

export async function updateSale(id: string, input: UpdateSaleInput): Promise<void> {
  const profile = await requireProfile();
  await requirePermission('sales', 'edit');

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

// The actual void — shared by the immediate path (deleteSale, no approval
// needed) and the approved-request path (approvals.ts).
export async function performDeleteSale(
  ctx: { orgId: string; userId: string; role: UserRole; actorName: string },
  sale: { id: string; total: number },
): Promise<void> {
  const { orgId, userId, role, actorName } = ctx;

  // A DELETE that RLS silently filters to 0 rows returns no error at all —
  // if this role has sales:delete but not inventory:delete_movement
  // (independently configurable via role_permissions), the movements would
  // never get removed, but without this check the sale row would still be
  // deleted right after, permanently desyncing the stock ledger.
  const { count: movementCount } = await supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('sale_id', sale.id);
  if ((movementCount ?? 0) > 0) {
    const { data: deletedMovements, error: movementsError } = await supabase.from('stock_movements').delete().eq('sale_id', sale.id).select('id');
    if (movementsError) throw new Error("Could not reverse this sale's stock impact.");
    if (!deletedMovements || deletedMovements.length === 0) {
      throw new Error("Could not reverse this sale's stock impact — you may be missing the permission needed to delete stock movements.");
    }
  }

  const { error: deleteError } = await supabase.from('sales').delete().eq('id', sale.id);
  if (deleteError) throw new Error('Could not delete the sale.');

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: 'sale.voided',
    module: 'Sales',
    entityType: 'sale',
    entityId: sale.id,
    newValue: { total: sale.total },
  });
}

export type DeleteSaleResult = { status: 'deleted' } | { status: 'pending_approval'; approvalRequestId: string };

export async function deleteSale(id: string, reason?: string): Promise<DeleteSaleResult> {
  const profile = await requireProfile();
  await requirePermission('sales', 'delete');

  const { data: sale, error: saleError } = await supabase.from('sales').select('id, total').eq('id', id).maybeSingle();
  if (saleError) throw new Error('Could not load this sale.');
  if (!sale) throw new Error('Sale not found.');

  const settings = await getApprovalSettings(profile.org_id);
  const needsApproval =
    !!settings?.void_approval_enabled &&
    Number(sale.total) > Number(settings.void_threshold_amount) &&
    profile.role !== 'owner' &&
    profile.role !== 'admin';

  const ctx = { orgId: profile.org_id, userId: profile.id, role: profile.role, actorName: `${profile.first_name} ${profile.last_name}` };

  if (needsApproval) {
    const requestId = await createApprovalRequest({
      orgId: profile.org_id,
      entityType: 'void_sale',
      entityId: id,
      requestedBy: profile.id,
      payload: { saleId: id, total: sale.total },
      reason,
      notifyTitle: 'Void needs approval',
      notifyBody: `${ctx.actorName} wants to void a sale worth ${Number(sale.total).toFixed(2)}.`,
    });
    return { status: 'pending_approval', approvalRequestId: requestId };
  }

  await performDeleteSale(ctx, sale as { id: string; total: number });
  return { status: 'deleted' };
}
