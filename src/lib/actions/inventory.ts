// Direct-Supabase equivalents of Inventra/lib/actions/inventory.ts and the
// transfer half of lib/actions/warehouses.ts — same validation/audit trail,
// called straight from the client. See lib/actions/products.ts's header
// comment for why this doesn't need a bearer-token API route the way
// billing does.
import { logAudit } from '@/lib/actions/audit';
import { isManagerRole } from '@/lib/roles';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { AdjustmentType, Category, Supplier } from '@/types/database';

// Inline "add new" during the product form — mirrors the same affordance
// on Inventra/components/products/ProductFormFields.tsx's category/supplier
// pickers.
export async function createCategory(name: string): Promise<Category> {
  const profile = await requireProfile();
  const { data, error } = await supabase
    .from('categories')
    .insert({ org_id: profile.org_id, name: name.trim(), emoji: null })
    .select('*')
    .single();
  if (error) throw new Error('Could not create category.');
  return data as Category;
}

export async function createSupplier(name: string): Promise<Supplier> {
  const profile = await requireProfile();
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ org_id: profile.org_id, name: name.trim() })
    .select('*')
    .single();
  if (error) throw new Error('Could not create supplier.');
  return data as Supplier;
}

export interface ProductPickerRow {
  id: string;
  name: string;
  sku: string;
  qty: number;
  // Display-only, for the cart's running-total preview — recordSale
  // re-fetches the live sell_price server-side right before charging, so a
  // stale price shown here can never actually be what gets billed.
  sellPrice: number;
}

// Debounced type-ahead search for pickers (Sale line items, Adjustments,
// Transfers) — mirrors searchProductsForPicker's ilike/index-backed search.
export async function searchProductsForPicker(query: string, limit = 20): Promise<ProductPickerRow[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, qty_on_hand, sell_price')
    .is('archived_at', null)
    .eq('is_active', true)
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`)
    .order('name', { ascending: true })
    .limit(limit);
  if (error) throw new Error('Could not search products.');
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, sku: p.sku, qty: p.qty_on_hand, sellPrice: p.sell_price }));
}

// Same lookup, but exact-match on sku/barcode — used by the barcode scanner.
export async function findProductByCode(code: string): Promise<ProductPickerRow | null> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, qty_on_hand, sell_price')
    .is('archived_at', null)
    .eq('is_active', true)
    .or(`sku.eq.${code},barcode.eq.${code}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Could not look up that code.');
  if (!data) return null;
  return { id: data.id, name: data.name, sku: data.sku, qty: data.qty_on_hand, sellPrice: data.sell_price };
}

export interface CreateAdjustmentInput {
  productId: string;
  qtyDelta: number;
  reason: string;
  notes?: string;
  adjustmentType: AdjustmentType;
  // Expiry write-offs are their own movement type so the ledger stays honest.
  kind: 'adjustment' | 'expired';
}

export async function createAdjustment(input: CreateAdjustmentInput): Promise<void> {
  const profile = await requireProfile();

  if (!input.productId) throw new Error('Pick a product.');
  if (!Number.isInteger(input.qtyDelta) || input.qtyDelta === 0) {
    throw new Error('Quantity must be a non-zero whole number.');
  }
  if (!input.reason.trim()) throw new Error('A reason is required for the audit trail.');

  const { data: product } = await supabase
    .from('products')
    .select('name, warehouse_id, qty_on_hand')
    .eq('id', input.productId)
    .single();
  if (!product) throw new Error('Product not found.');
  if (product.qty_on_hand + input.qtyDelta < 0) {
    throw new Error(`Stock can't go negative — only ${product.qty_on_hand} on hand.`);
  }

  const { error } = await supabase.from('stock_movements').insert({
    org_id: profile.org_id,
    product_id: input.productId,
    warehouse_id: product.warehouse_id,
    type: input.kind,
    qty_delta: input.qtyDelta,
    unit_price: null,
    reason: input.reason.trim(),
    notes: input.notes?.trim() || null,
    adjustment_type: input.adjustmentType,
    sale_id: null,
    created_by: profile.id,
  });
  if (error) throw error;

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'stock.adjusted',
    module: 'Inventory',
    entityType: 'product',
    entityId: input.productId,
    entityLabel: product.name,
    newValue: {
      qtyOnHand: product.qty_on_hand + input.qtyDelta,
      qtyDelta: input.qtyDelta,
      adjustmentType: input.adjustmentType,
      reason: input.reason.trim(),
    },
  });
}

// Reassigns a product's whole stock to another warehouse — not a
// partial-quantity split, matching web's own transferWarehouseStock.
export async function transferWarehouseStock(productId: string, toWarehouseId: string, reason?: string): Promise<void> {
  const profile = await requireProfile();
  if (!isManagerRole(profile.role)) {
    throw new Error('Only an owner, admin, or manager can transfer stock.');
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, warehouse_id, qty_on_hand')
    .eq('id', productId)
    .eq('org_id', profile.org_id)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error('Product not found.');
  if (product.warehouse_id === toWarehouseId) throw new Error('Product is already in that warehouse.');

  const { error: updateError } = await supabase
    .from('products')
    .update({ warehouse_id: toWarehouseId })
    .eq('id', productId)
    .eq('org_id', profile.org_id);
  if (updateError) throw new Error('Could not transfer the product.');

  const { error: movementError } = await supabase.from('stock_movements').insert({
    org_id: profile.org_id,
    product_id: productId,
    warehouse_id: toWarehouseId,
    type: 'transfer',
    qty_delta: 0,
    unit_price: null,
    reason: reason?.trim() || `Transferred ${product.qty_on_hand} units to another warehouse`,
    adjustment_type: null,
    notes: null,
    sale_id: null,
    created_by: profile.id,
  });
  if (movementError) throw new Error('Product was moved, but the movement log entry could not be recorded.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'stock.transferred',
    module: 'Inventory',
    entityType: 'product',
    entityId: productId,
    entityLabel: product.name,
    newValue: { toWarehouseId },
  });
}
