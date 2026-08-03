// Direct-Supabase equivalents of Inventra/lib/actions/products.ts's Server
// Actions — same validation, same RLS-scoped role gates (isManagerRole),
// same audit trail, just called straight from the client instead of through
// a Next.js server hop. Nothing here needs a secret key (unlike billing's
// Paystack calls), so there's no need for a bearer-token API route the way
// billing has one — RLS is the real enforcement boundary either way.
import { logAudit } from '@/lib/actions/audit';
import { createApprovalRequest, getApprovalSettings } from '@/lib/approval-service';
import { canAddProduct, canBulkImportExport, canDeleteProduct, canEditProduct, UpgradeRequiredError } from '@/lib/entitlements';
import { logError } from '@/lib/logger';
import { requirePermission } from '@/lib/permissions';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/database';

export interface CreateProductInput {
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
  supplierId?: string;
  warehouseId?: string;
  openingQty: number;
  imageUrl?: string;
}

export async function createProduct(input: CreateProductInput): Promise<string> {
  const profile = await requireProfile();
  await requirePermission('inventory', 'create');
  if (!(await canAddProduct())) {
    throw new UpgradeRequiredError("You've reached your Free Plan limit of 20 products. Upgrade to Premium for unlimited products.");
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      org_id: profile.org_id,
      name: input.name,
      description: input.description || null,
      emoji: null,
      sku: input.sku,
      barcode: input.barcode?.trim() || null,
      category_id: input.categoryId || null,
      unit: input.unit || 'each',
      cost_price: input.costPrice,
      sell_price: input.sellPrice,
      reorder_level: input.reorderLevel,
      supplier_id: input.supplierId || null,
      warehouse_id: input.warehouseId || null,
      image_url: input.imageUrl || null,
      qty_on_hand: 0,
      qty_reserved: 0,
      qty_damaged: 0,
      qty_returned: 0,
      is_active: true,
      brand: null,
      expiry_date: null,
      batch_number: null,
      archived_at: null,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('A product with this SKU or barcode already exists.');
    logError({ feature: 'Products', action: 'createProduct', orgId: profile.org_id }, 'product insert failed', error);
    throw new Error('Could not create the product.');
  }

  if (input.openingQty > 0) {
    // inventory:create and inventory:create_movement are independently
    // toggleable (role_permissions) — a role that can create products but
    // not movements would have this insert silently RLS-filtered to 0 rows
    // with no error, leaving qty_on_hand at 0 while the product itself
    // reports success. Surface it instead of failing silently.
    const { error: movementError } = await supabase.from('stock_movements').insert({
      org_id: profile.org_id,
      product_id: product.id,
      warehouse_id: input.warehouseId || null,
      type: 'received',
      qty_delta: input.openingQty,
      unit_price: null,
      reason: 'Opening stock',
      adjustment_type: null,
      notes: null,
      sale_id: null,
      created_by: profile.id,
    });
    if (movementError) {
      throw new Error('Product was created, but opening stock could not be recorded. Add it from the product page.');
    }
  }

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'product.created',
    module: 'Products',
    entityType: 'product',
    entityId: product.id as string,
    entityLabel: input.name,
    newValue: { name: input.name, sku: input.sku, costPrice: input.costPrice, sellPrice: input.sellPrice },
  });

  return product.id as string;
}

export interface UpdateProductInput {
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  unit: string;
  brand?: string;
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
  supplierId?: string;
  warehouseId?: string;
  expiryDate?: string;
  imageUrl?: string;
}

// % change relative to the current value; a move away from a currently-zero
// price is always treated as needing approval when enabled.
function pctChange(before: number, after: number): number {
  if (before === after) return 0;
  if (before === 0) return Infinity;
  return (Math.abs(after - before) / before) * 100;
}

// The actual write — shared by the immediate path (updateProduct, no
// approval needed) and the approved-request path (approvals.ts). A price
// change over threshold holds the entire edit for approval, not just price.
export async function performUpdateProduct(
  ctx: { orgId: string; userId: string; role: UserRole; actorName: string },
  id: string,
  input: UpdateProductInput,
): Promise<void> {
  const { orgId, userId, role, actorName } = ctx;
  const name = input.name.trim();
  const sku = input.sku.trim();

  const { data: updated, error } = await supabase
    .from('products')
    .update({
      name,
      description: input.description?.trim() || null,
      sku,
      barcode: input.barcode?.trim() || null,
      category_id: input.categoryId || null,
      unit: input.unit || 'each',
      brand: input.brand?.trim() || null,
      cost_price: input.costPrice,
      sell_price: input.sellPrice,
      reorder_level: input.reorderLevel,
      supplier_id: input.supplierId || null,
      warehouse_id: input.warehouseId || null,
      expiry_date: input.expiryDate || null,
      image_url: input.imageUrl || null,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') throw new Error('A product with this SKU or barcode already exists.');
    logError({ feature: 'Products', action: 'updateProduct', orgId }, 'product update failed', error);
    throw new Error('Could not update the product.');
  }
  // A Postgres UPDATE that matches zero rows (wrong id, or blocked by RLS)
  // returns no error at all — without this check the caller would show a
  // false "saved" success while nothing changed.
  if (!updated) {
    throw new Error('Could not update the product — it may have been deleted or you no longer have access to it.');
  }

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: 'product.updated',
    module: 'Products',
    entityType: 'product',
    entityId: id,
    entityLabel: name,
    newValue: { name, sku, costPrice: input.costPrice, sellPrice: input.sellPrice },
  });
}

export type UpdateProductResult = { status: 'updated' } | { status: 'pending_approval'; approvalRequestId: string };

export async function updateProduct(id: string, input: UpdateProductInput): Promise<UpdateProductResult> {
  const profile = await requireProfile();
  await requirePermission('inventory', 'edit');
  if (!(await canEditProduct())) throw new UpgradeRequiredError('Editing inventory requires a Premium subscription.');
  const name = input.name.trim();
  const sku = input.sku.trim();
  if (!name) throw new Error('Product name is required.');
  if (!sku) throw new Error('SKU is required.');

  const { data: clash } = await supabase
    .from('products')
    .select('id')
    .eq('org_id', profile.org_id)
    .eq('sku', sku)
    .neq('id', id)
    .maybeSingle();
  if (clash) throw new Error('Another product already uses this SKU.');

  const { data: current } = await supabase.from('products').select('name, cost_price, sell_price').eq('id', id).maybeSingle();

  const settings = await getApprovalSettings(profile.org_id);
  const priceChangePct = current
    ? Math.max(pctChange(Number(current.cost_price), input.costPrice), pctChange(Number(current.sell_price), input.sellPrice))
    : 0;
  const needsApproval =
    !!settings?.price_change_approval_enabled &&
    priceChangePct > Number(settings.price_change_threshold_pct) &&
    profile.role !== 'owner' &&
    profile.role !== 'admin';

  const ctx = { orgId: profile.org_id, userId: profile.id, role: profile.role, actorName: `${profile.first_name} ${profile.last_name}` };

  if (needsApproval) {
    const requestId = await createApprovalRequest({
      orgId: profile.org_id,
      entityType: 'price_change',
      entityId: id,
      requestedBy: profile.id,
      payload: { productId: id, input, before: current },
      notifyTitle: 'Price change needs approval',
      notifyBody: `${ctx.actorName} wants to change prices on "${current?.name ?? name}" (${priceChangePct === Infinity ? '>100' : priceChangePct.toFixed(0)}% change).`,
    });
    return { status: 'pending_approval', approvalRequestId: requestId };
  }

  await performUpdateProduct(ctx, id, input);
  return { status: 'updated' };
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  const profile = await requireProfile();
  await requirePermission('inventory', 'edit');
  const { data: updated, error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select('id')
    .maybeSingle();
  if (error) throw new Error("Could not update the product's status.");
  if (!updated) throw new Error('Could not update the product — it may have been deleted or you no longer have access to it.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'product.updated',
    module: 'Products',
    entityType: 'product',
    entityId: id,
    newValue: { is_active: isActive },
  });
}

export async function archiveProduct(id: string): Promise<void> {
  const profile = await requireProfile();
  await requirePermission('inventory', 'edit');
  if (!(await canEditProduct())) throw new UpgradeRequiredError('Archiving inventory requires a Premium subscription.');
  const { data: archived, error } = await supabase
    .from('products')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!archived) throw new Error('Could not archive the product — it may have been deleted or you no longer have access to it.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'product.archived',
    module: 'Products',
    entityType: 'product',
    entityId: id,
  });
}

// Delete is blocked once a product has any stock/sale history — archive
// keeps that history intact instead, same rule as web.
export async function deleteProduct(id: string): Promise<void> {
  const profile = await requireProfile();
  await requirePermission('inventory', 'delete');
  if (!(await canDeleteProduct())) throw new UpgradeRequiredError('Deleting inventory requires a Premium subscription.');

  const { count } = await supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', id);
  if ((count ?? 0) > 0) {
    throw new Error('This product has stock/sale history — use Archive instead to keep its records intact.');
  }

  const { data: deleted, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select('id')
    .maybeSingle();
  if (error) {
    logError({ feature: 'Products', action: 'deleteProduct', orgId: profile.org_id }, 'product delete failed', error);
    throw new Error('Could not delete the product.');
  }
  if (!deleted) throw new Error('Could not delete the product — it may have already been removed.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'product.deleted',
    module: 'Products',
    entityType: 'product',
    entityId: id,
  });
}

// Mirrors Inventra/lib/actions/products.ts's uploadProductImage — bucket
// name and path convention (`${orgId}/${uniqueName}.${ext}`) match exactly
// so both apps' uploads land in the same Supabase Storage bucket.
export async function uploadProductImage(localUri: string, orgId: string): Promise<string> {
  // Shared by both the Add and Edit product forms, so either permission
  // suffices.
  const [{ data: canCreate }, { data: canEdit }] = await Promise.all([
    supabase.rpc('has_permission', { p_module: 'inventory', p_action: 'create' }),
    supabase.rpc('has_permission', { p_module: 'inventory', p_action: 'edit' }),
  ]);
  if (!canCreate && !canEdit) {
    throw new Error("You don't have permission to do that.");
  }

  const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${orgId}/${uniqueName}.${ext}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > 5 * 1024 * 1024) throw new Error('Image must be under 5MB.');

  const { error } = await supabase.storage.from('product-images').upload(path, arrayBuffer, {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: false,
  });
  if (error) throw new Error('Could not upload the image.');

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

// Mirrors Inventra/lib/actions/products.ts's importProductsCsv exactly —
// same resolve-by-name-or-create-on-the-fly logic for categories/
// suppliers, same prefetched SKU map so a duplicate SKU later in the same
// file resolves to an update instead of a unique-constraint error.
export interface ImportProductRow {
  name?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  brand?: string;
  category?: string;
  supplier?: string;
  warehouse?: string;
  unit?: string;
  cost_price?: string;
  sell_price?: string;
  reorder_level?: string;
  qty_on_hand?: string;
  expiry_date?: string;
  image_url?: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export async function importProductsCsv(rows: ImportProductRow[]): Promise<ImportResult> {
  const profile = await requireProfile();
  await requirePermission('inventory', 'create');
  if (!(await canBulkImportExport())) throw new UpgradeRequiredError('Bulk importing products requires a Premium subscription.');
  const orgId = profile.org_id;
  const result: ImportResult = { created: 0, updated: 0, failed: 0, errors: [] };

  const [{ data: categories }, { data: suppliers }, { data: warehouses }, { data: existingProducts }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('org_id', orgId),
    supabase.from('suppliers').select('id, name').eq('org_id', orgId),
    supabase.from('warehouses').select('id, name').eq('org_id', orgId),
    supabase.from('products').select('id, sku').eq('org_id', orgId),
  ]);
  const categoryByName = new Map((categories ?? []).map((c) => [c.name.toLowerCase(), c.id]));
  const supplierByName = new Map((suppliers ?? []).map((s) => [s.name.toLowerCase(), s.id]));
  const warehouseByName = new Map((warehouses ?? []).map((w) => [w.name.toLowerCase(), w.id]));
  const productIdBySku = new Map((existingProducts ?? []).map((p) => [p.sku, p.id]));

  async function resolveCategoryId(name: string | undefined): Promise<string | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const existing = categoryByName.get(trimmed.toLowerCase());
    if (existing) return existing;
    const { data, error } = await supabase.from('categories').insert({ org_id: orgId, name: trimmed, emoji: null }).select('id').single();
    if (error || !data) return null;
    categoryByName.set(trimmed.toLowerCase(), data.id);
    return data.id;
  }

  async function resolveSupplierId(name: string | undefined): Promise<string | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const existing = supplierByName.get(trimmed.toLowerCase());
    if (existing) return existing;
    const { data, error } = await supabase.from('suppliers').insert({ org_id: orgId, name: trimmed }).select('id').single();
    if (error || !data) return null;
    supplierByName.set(trimmed.toLowerCase(), data.id);
    return data.id;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // header is row 1
    try {
      const name = row.name?.trim();
      const sku = row.sku?.trim();
      if (!name) throw new Error('Missing product name.');
      if (!sku) throw new Error('Missing SKU.');

      const costPrice = row.cost_price ? Number(row.cost_price) : 0;
      const sellPrice = row.sell_price ? Number(row.sell_price) : 0;
      const reorderLevel = row.reorder_level ? Number(row.reorder_level) : 0;
      if ([costPrice, sellPrice, reorderLevel].some((n) => Number.isNaN(n))) {
        throw new Error('Cost price, sell price, and reorder level must be numbers.');
      }

      const categoryId = await resolveCategoryId(row.category);
      const supplierId = await resolveSupplierId(row.supplier);
      const warehouseId = row.warehouse?.trim() ? (warehouseByName.get(row.warehouse.trim().toLowerCase()) ?? null) : null;

      const existingId = productIdBySku.get(sku);

      if (existingId) {
        const { error } = await supabase
          .from('products')
          .update({
            name,
            description: row.description?.trim() || null,
            barcode: row.barcode?.trim() || null,
            brand: row.brand?.trim() || null,
            category_id: categoryId,
            supplier_id: supplierId,
            warehouse_id: warehouseId,
            unit: row.unit?.trim() || 'each',
            cost_price: costPrice,
            sell_price: sellPrice,
            reorder_level: reorderLevel,
            image_url: row.image_url?.trim() || null,
          })
          .eq('id', existingId);
        if (error) throw new Error(error.message);
        result.updated++;
      } else {
        const qtyOnHand = row.qty_on_hand ? Number(row.qty_on_hand) : 0;
        const { data: created, error } = await supabase
          .from('products')
          .insert({
            org_id: orgId,
            name,
            sku,
            description: row.description?.trim() || null,
            emoji: null,
            barcode: row.barcode?.trim() || null,
            brand: row.brand?.trim() || null,
            category_id: categoryId,
            supplier_id: supplierId,
            warehouse_id: warehouseId,
            unit: row.unit?.trim() || 'each',
            cost_price: costPrice,
            sell_price: sellPrice,
            reorder_level: reorderLevel,
            qty_on_hand: 0,
            qty_reserved: 0,
            qty_damaged: 0,
            qty_returned: 0,
            expiry_date: row.expiry_date?.trim() || null,
            batch_number: null,
            image_url: row.image_url?.trim() || null,
            is_active: true,
            archived_at: null,
          })
          .select('id')
          .single();
        if (error || !created) throw new Error(error?.message ?? 'Insert failed.');
        productIdBySku.set(sku, created.id);

        if (qtyOnHand > 0) {
          const { error: movementError } = await supabase.from('stock_movements').insert({
            org_id: orgId,
            product_id: created.id,
            warehouse_id: warehouseId,
            type: 'received',
            qty_delta: qtyOnHand,
            unit_price: null,
            reason: 'CSV import — opening stock',
            adjustment_type: null,
            notes: null,
            sale_id: null,
            created_by: profile.id,
          });
          if (movementError) throw new Error('Product created, but opening stock could not be recorded.');
        }
        result.created++;
      }
    } catch (err) {
      result.failed++;
      result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : 'Unknown error.' });
    }
  }

  if (result.created > 0 || result.updated > 0) {
    void logAudit({
      orgId,
      actorId: profile.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: 'product.imported',
      module: 'Products',
      entityType: 'product',
      entityLabel: `CSV import (${result.created} created, ${result.updated} updated, ${result.failed} failed)`,
      newValue: { created: result.created, updated: result.updated, failed: result.failed },
    });
  }

  return result;
}
