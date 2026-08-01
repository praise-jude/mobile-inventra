// Direct-Supabase equivalent of Inventra/lib/actions/supply-records.ts.
// Create/edit/receive/verify/cancel are Manager+ only (Staff spec'd as
// "view only if granted") — matches supply_records_insert/update RLS.
import { logAudit } from '@/lib/actions/audit';
import { notifyApprovers } from '@/lib/actions/notifications';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { SupplyStatus } from '@/types/database';

function requireManagerRole(role: string) {
  if (!['owner', 'admin', 'manager'].includes(role)) {
    throw new Error('Only an owner, admin, or manager can manage supply records.');
  }
}

// crypto.randomUUID() isn't reliably available in the Hermes runtime; the
// app already polyfills crypto.getRandomValues (src/lib/supabase.ts), so
// build the same 8-hex-char suffix web's randomUUID().slice(0,8) produces
// from that instead of adding a new uuid dependency — mirrors invoices.ts.
function randomSupplySuffix(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export interface SupplyRecordItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface SupplyRecordInput {
  supplierId?: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  invoiceNumber?: string;
  warehouseId: string;
  dateSupplied: string;
  notes?: string;
  items: SupplyRecordItemInput[];
}

async function notifyNewSupply(orgId: string, userId: string, supplyId: string, referenceNumber: string, totalAmount: number) {
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('new_purchase_orders, large_supply_threshold_amount')
    .eq('org_id', orgId)
    .maybeSingle();
  if (!settings?.new_purchase_orders) return;

  const overThreshold = settings.large_supply_threshold_amount != null && totalAmount > settings.large_supply_threshold_amount;
  await notifyApprovers({
    orgId,
    excludeUserId: userId,
    type: overThreshold ? 'large_supply_recorded' : 'supply_recorded',
    title: overThreshold ? 'Large supply recorded' : 'New supply recorded',
    body: `${referenceNumber} — a supply record was created.`,
    entityType: 'supply_record',
    entityId: supplyId,
  });
}

export async function createSupplyRecord(input: SupplyRecordInput): Promise<string> {
  const profile = await requireProfile();
  requireManagerRole(profile.role);

  const supplierName = input.supplierName.trim();
  if (!supplierName) throw new Error('Supplier name is required.');
  if (input.items.length === 0) throw new Error('Add at least one product.');
  for (const item of input.items) {
    if (item.quantity <= 0) throw new Error('Quantity must be greater than zero.');
    if (item.unitCost < 0) throw new Error("Unit cost can't be negative.");
  }

  const totalQuantity = input.items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const referenceNumber = `SR-${randomSupplySuffix()}`;

  const { data: record, error } = await supabase
    .from('supply_records')
    .insert({
      org_id: profile.org_id,
      reference_number: referenceNumber,
      supplier_id: input.supplierId || null,
      supplier_name: supplierName,
      supplier_phone: input.supplierPhone?.trim() || null,
      supplier_email: input.supplierEmail?.trim() || null,
      invoice_number: input.invoiceNumber?.trim() || null,
      warehouse_id: input.warehouseId,
      date_supplied: input.dateSupplied,
      total_quantity: totalQuantity,
      total_amount: totalAmount,
      notes: input.notes?.trim() || null,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (error || !record) {
    console.error('[Royal Inventra] createSupplyRecord failed:', error);
    throw new Error('Could not create the supply record.');
  }

  const { error: itemsError } = await supabase.from('supply_record_items').insert(
    input.items.map((i) => ({
      org_id: profile.org_id,
      supply_record_id: record.id,
      product_id: i.productId,
      quantity: i.quantity,
      unit_cost: i.unitCost,
      line_total: i.quantity * i.unitCost,
    })),
  );
  if (itemsError) {
    console.error('[Royal Inventra] createSupplyRecord items failed:', itemsError);
    throw new Error('Could not save the supply’s product lines. The record was created but is empty — please delete it and try again.');
  }

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'supply_record.created',
    module: 'Supply Records',
    entityType: 'supply_record',
    entityId: record.id,
    entityLabel: `${referenceNumber} — ${supplierName}`,
    newValue: { supplierName, totalQuantity, totalAmount, itemCount: input.items.length },
  });

  await notifyNewSupply(profile.org_id, profile.id, record.id, referenceNumber, totalAmount);

  return record.id as string;
}

export async function updateSupplyRecord(id: string, input: SupplyRecordInput): Promise<void> {
  const profile = await requireProfile();
  requireManagerRole(profile.role);

  const { data: existing } = await supabase.from('supply_records').select('status, reference_number').eq('id', id).eq('org_id', profile.org_id).single();
  if (!existing) throw new Error('Supply record not found.');
  if (existing.status !== 'pending') throw new Error('Only pending supplies can be edited.');

  const supplierName = input.supplierName.trim();
  if (!supplierName) throw new Error('Supplier name is required.');
  if (input.items.length === 0) throw new Error('Add at least one product.');
  for (const item of input.items) {
    if (item.quantity <= 0) throw new Error('Quantity must be greater than zero.');
    if (item.unitCost < 0) throw new Error("Unit cost can't be negative.");
  }

  const totalQuantity = input.items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const { error } = await supabase
    .from('supply_records')
    .update({
      supplier_id: input.supplierId || null,
      supplier_name: supplierName,
      supplier_phone: input.supplierPhone?.trim() || null,
      supplier_email: input.supplierEmail?.trim() || null,
      invoice_number: input.invoiceNumber?.trim() || null,
      warehouse_id: input.warehouseId,
      date_supplied: input.dateSupplied,
      total_quantity: totalQuantity,
      total_amount: totalAmount,
      notes: input.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('org_id', profile.org_id);
  if (error) {
    console.error('[Royal Inventra] updateSupplyRecord failed:', error);
    throw new Error('Could not update this supply record.');
  }

  const { error: deleteError } = await supabase.from('supply_record_items').delete().eq('supply_record_id', id);
  if (deleteError) throw new Error("Could not update this supply's product lines.");
  const { error: itemsError } = await supabase.from('supply_record_items').insert(
    input.items.map((i) => ({
      org_id: profile.org_id,
      supply_record_id: id,
      product_id: i.productId,
      quantity: i.quantity,
      unit_cost: i.unitCost,
      line_total: i.quantity * i.unitCost,
    })),
  );
  if (itemsError) throw new Error("Could not save this supply's product lines.");

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'supply_record.updated',
    module: 'Supply Records',
    entityType: 'supply_record',
    entityId: id,
    entityLabel: existing.reference_number,
    newValue: { supplierName, totalQuantity, totalAmount, itemCount: input.items.length },
  });
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['received', 'cancelled'],
  received: ['verified', 'cancelled'],
  verified: ['cancelled'],
  cancelled: [],
};

export async function changeSupplyRecordStatus(id: string, newStatus: 'received' | 'verified' | 'cancelled'): Promise<void> {
  const profile = await requireProfile();
  requireManagerRole(profile.role);

  const { data: existing } = await supabase
    .from('supply_records')
    .select('status, reference_number, total_amount, supplier_name')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single();
  if (!existing) throw new Error('Supply record not found.');
  if (!STATUS_TRANSITIONS[existing.status]?.includes(newStatus)) {
    throw new Error(`Can't move a ${existing.status} supply to ${newStatus}.`);
  }

  const update: Partial<{ status: SupplyStatus; verified_by: string; verified_at: string; cancelled_by: string; cancelled_at: string }> = {
    status: newStatus,
  };
  if (newStatus === 'verified') {
    update.verified_by = profile.id;
    update.verified_at = new Date().toISOString();
  }
  if (newStatus === 'cancelled') {
    update.cancelled_by = profile.id;
    update.cancelled_at = new Date().toISOString();
  }

  // The DB trigger (apply_supply_record_status_change) does the actual
  // stock math — this just validates the transition and records who did it.
  const { error } = await supabase.from('supply_records').update(update).eq('id', id).eq('org_id', profile.org_id);
  if (error) {
    console.error('[Royal Inventra] changeSupplyRecordStatus failed:', error);
    throw new Error("Could not update this supply's status.");
  }

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: `supply_record.${newStatus}`,
    module: 'Supply Records',
    entityType: 'supply_record',
    entityId: id,
    entityLabel: existing.reference_number,
    newValue: { status: newStatus },
  });

  const { data: settings } = await supabase.from('notification_settings').select('new_purchase_orders').eq('org_id', profile.org_id).maybeSingle();
  if (settings?.new_purchase_orders) {
    await notifyApprovers({
      orgId: profile.org_id,
      excludeUserId: profile.id,
      type: `supply_${newStatus}`,
      title: newStatus === 'cancelled' ? 'Supply record cancelled' : `Supply ${newStatus}`,
      body: `${existing.reference_number} — ${existing.supplier_name} — marked ${newStatus} by ${profile.first_name} ${profile.last_name}.`,
      entityType: 'supply_record',
      entityId: id,
    });
  }
}

export async function softDeleteSupplyRecord(id: string): Promise<void> {
  const profile = await requireProfile();
  requireManagerRole(profile.role);

  const { data: existing } = await supabase.from('supply_records').select('status, reference_number').eq('id', id).eq('org_id', profile.org_id).single();
  if (!existing) throw new Error('Supply record not found.');
  if (existing.status !== 'pending' && existing.status !== 'cancelled') {
    throw new Error('Only pending or cancelled supplies can be deleted — cancel it first.');
  }

  const { error } = await supabase.from('supply_records').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('org_id', profile.org_id);
  if (error) {
    console.error('[Royal Inventra] softDeleteSupplyRecord failed:', error);
    throw new Error('Could not delete this supply record.');
  }

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'supply_record.deleted',
    module: 'Supply Records',
    entityType: 'supply_record',
    entityId: id,
    entityLabel: existing.reference_number,
  });
}
