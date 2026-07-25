// Direct-Supabase equivalent of Inventra/lib/actions/warehouses.ts.
import { logAudit } from '@/lib/actions/audit';
import { isAdminRole, isManagerRole } from '@/lib/roles';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Branch create/edit/archive/delete is owner/admin only —
// warehouses_insert/update/delete RLS already enforces this at the database
// layer, this just gives a clear error instead of a silent RLS no-op.
async function requireAdminProfile() {
  const profile = await requireProfile();
  if (!isAdminRole(profile.role)) throw new Error('Only an owner or admin can manage branches.');
  return profile;
}

// Transferring stock between branches is day-to-day inventory work, not
// branch administration — manager-tier+, distinct from the admin-only gate
// above, and only app-layer gated (no special RLS rule for it).
async function requireManagerProfile() {
  const profile = await requireProfile();
  if (!isManagerRole(profile.role)) throw new Error('Only an owner, admin, or manager can transfer stock.');
  return profile;
}

export interface WarehouseInput {
  name: string;
  address?: string;
  country?: string;
  state?: string;
  phone?: string;
  managerProfileId?: string;
  capacity?: number;
}

function normalize(input: WarehouseInput) {
  return {
    name: input.name.trim(),
    address: input.address?.trim() || null,
    country: input.country?.trim() || null,
    state: input.state?.trim() || null,
    phone: input.phone?.trim() || null,
    manager_profile_id: input.managerProfileId || null,
    capacity: input.capacity && input.capacity > 0 ? input.capacity : null,
  };
}

export async function createWarehouse(input: WarehouseInput): Promise<void> {
  const profile = await requireAdminProfile();
  const values = normalize(input);
  if (!values.name) throw new Error('Branch name is required.');

  const { data, error } = await supabase.from('warehouses').insert({ org_id: profile.org_id, ...values }).select('id, name').single();
  if (error) throw new Error('Could not create the branch.');

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'branch.created',
    module: 'Branches',
    entityType: 'warehouse',
    entityId: data.id,
    entityLabel: data.name,
    newValue: values,
  });
}

export async function updateWarehouse(id: string, input: WarehouseInput): Promise<void> {
  const profile = await requireAdminProfile();
  const values = normalize(input);
  if (!values.name) throw new Error('Branch name is required.');

  const { error } = await supabase.from('warehouses').update(values).eq('id', id);
  if (error) throw new Error('Could not update the branch.');

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'branch.updated',
    module: 'Branches',
    entityType: 'warehouse',
    entityId: id,
    entityLabel: values.name,
    newValue: values,
  });
}

async function setStatus(id: string, status: 'active' | 'inactive') {
  const profile = await requireAdminProfile();
  const { data: warehouse } = await supabase.from('warehouses').select('name').eq('id', id).maybeSingle();
  const { error } = await supabase.from('warehouses').update({ status }).eq('id', id);
  if (error) throw new Error(`Could not ${status === 'inactive' ? 'archive' : 'reactivate'} the branch.`);

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'branch.updated',
    module: 'Branches',
    entityType: 'warehouse',
    entityId: id,
    entityLabel: warehouse?.name ?? id,
    newValue: { status },
  });
}

export const archiveWarehouse = (id: string) => setStatus(id, 'inactive');
export const reactivateWarehouse = (id: string) => setStatus(id, 'active');

export async function deleteWarehouse(id: string): Promise<void> {
  await requireAdminProfile();

  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('warehouse_id', id);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} product${count === 1 ? '' : 's'} still assigned to this branch — reassign or transfer them first.`);
  }

  const { error } = await supabase.from('warehouses').delete().eq('id', id);
  if (error) throw new Error('Could not delete the branch.');
}

export async function transferWarehouseStock(productId: string, toWarehouseId: string, reason?: string): Promise<void> {
  const profile = await requireManagerProfile();

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, warehouse_id, qty_on_hand')
    .eq('id', productId)
    .eq('org_id', profile.org_id)
    .maybeSingle();
  if (productError) throw new Error('Could not load this product.');
  if (!product) throw new Error('Product not found.');
  if (product.warehouse_id === toWarehouseId) throw new Error('Product is already in that branch.');

  const { error: updateError } = await supabase.from('products').update({ warehouse_id: toWarehouseId }).eq('id', productId).eq('org_id', profile.org_id);
  if (updateError) throw new Error('Could not transfer the product.');

  const { error: movementError } = await supabase.from('stock_movements').insert({
    org_id: profile.org_id,
    product_id: productId,
    warehouse_id: toWarehouseId,
    type: 'transfer',
    qty_delta: 0,
    unit_price: null,
    reason: reason?.trim() || `Transferred ${product.qty_on_hand} units to another branch`,
    notes: null,
    adjustment_type: null,
    sale_id: null,
    created_by: profile.id,
  });
  if (movementError) throw new Error('Could not record the transfer.');

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'inventory.transferred',
    module: 'Inventory',
    entityType: 'product',
    entityId: productId,
    entityLabel: product.name,
    newValue: { toWarehouseId, qty: product.qty_on_hand },
  });
}
