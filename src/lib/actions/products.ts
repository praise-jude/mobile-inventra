// Direct-Supabase equivalents of Inventra/lib/actions/products.ts's Server
// Actions — same validation, same RLS-scoped role gates (isManagerRole),
// same audit trail, just called straight from the client instead of through
// a Next.js server hop. Nothing here needs a secret key (unlike billing's
// Paystack calls), so there's no need for a bearer-token API route the way
// billing has one — RLS is the real enforcement boundary either way.
import { logAudit } from '@/lib/actions/audit';
import { requirePermission } from '@/lib/permissions';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';

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

export async function updateProduct(id: string, input: UpdateProductInput): Promise<void> {
  const profile = await requireProfile();
  await requirePermission('inventory', 'edit');
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
    .eq('org_id', profile.org_id)
    .select('id')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') throw new Error('A product with this SKU or barcode already exists.');
    throw new Error('Could not update the product.');
  }
  // A Postgres UPDATE that matches zero rows (wrong id, or blocked by RLS)
  // returns no error at all — without this check the caller would show a
  // false "saved" success while nothing changed.
  if (!updated) {
    throw new Error('Could not update the product — it may have been deleted or you no longer have access to it.');
  }

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'product.updated',
    module: 'Products',
    entityType: 'product',
    entityId: id,
    entityLabel: name,
    newValue: { name, sku, costPrice: input.costPrice, sellPrice: input.sellPrice },
  });
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
  if (error) throw new Error('Could not delete the product.');
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
