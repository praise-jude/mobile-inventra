// Direct-Supabase equivalent of Inventra/lib/actions/debtors.ts. Customer
// management is a full Premium lock (canManageCustomers()), not a
// free-tier count limit — matches RLS on debtors/debtor_payments, which
// blocks select/insert/update/delete entirely for Free-tier orgs.
import { logAudit } from '@/lib/actions/audit';
import { canManageCustomers, UpgradeRequiredError } from '@/lib/entitlements';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Debtor, DebtorStatus } from '@/types/database';

export interface DebtorInput {
  customerName: string;
  phone?: string;
  email?: string;
  amountOwed: number;
  dueDate?: string;
  notes?: string;
}

export async function createDebtor(input: DebtorInput): Promise<void> {
  const profile = await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  const customerName = input.customerName.trim();
  if (!customerName) throw new Error('Customer name is required.');
  if (input.amountOwed < 0) throw new Error("Amount owed can't be negative.");

  // Tags the record with whatever branch the creating user is at (if any) —
  // not restricted to Cashier/Warehouse roles, mirrors
  // Inventra/lib/actions/debtors.ts's createDebtor exactly. Cashier/
  // Warehouse read access to debtors is branch-scoped by RLS (see
  // 20260803183000_branch_scope_debtors.sql on web, same shared database).
  const { data: debtor, error } = await supabase
    .from('debtors')
    .insert({
      org_id: profile.org_id,
      warehouse_id: profile.branch_id,
      customer_name: customerName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      amount_owed: input.amountOwed,
      due_date: input.dueDate || null,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw new Error('Could not create the debtor.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'customer.created',
    module: 'Customers',
    entityType: 'debtor',
    entityId: debtor.id as string,
    entityLabel: customerName,
    newValue: { amountOwed: input.amountOwed },
  });
}

export async function updateDebtor(id: string, input: DebtorInput & { status?: DebtorStatus }): Promise<void> {
  const profile = await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  const customerName = input.customerName.trim();
  if (!customerName) throw new Error('Customer name is required.');

  const patch: Partial<Pick<Debtor, 'customer_name' | 'phone' | 'email' | 'notes' | 'due_date' | 'status'>> = {
    customer_name: customerName,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    due_date: input.dueDate || null,
    notes: input.notes?.trim() || null,
  };
  if (input.status) patch.status = input.status;

  const { error } = await supabase.from('debtors').update(patch).eq('id', id);
  if (error) throw new Error('Could not update the debtor.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'customer.updated',
    module: 'Customers',
    entityType: 'debtor',
    entityId: id,
    entityLabel: customerName,
    newValue: { amountOwed: input.amountOwed, status: input.status },
  });
}

export async function updateDebtorStatus(id: string, status: DebtorStatus): Promise<void> {
  const profile = await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  const { data: debtor } = await supabase.from('debtors').select('customer_name').eq('id', id).maybeSingle();
  const { error } = await supabase.from('debtors').update({ status }).eq('id', id);
  if (error) throw new Error("Could not update the debtor's status.");

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'customer.status_changed',
    module: 'Customers',
    entityType: 'debtor',
    entityId: id,
    entityLabel: debtor?.customer_name ?? id,
    newValue: { status },
  });
}

export async function deleteDebtor(id: string): Promise<void> {
  const profile = await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  if (!['owner', 'admin'].includes(profile.role)) {
    throw new Error('Only an owner or admin can delete a debtor.');
  }

  const { data: debtor } = await supabase.from('debtors').select('customer_name').eq('id', id).maybeSingle();
  const { error } = await supabase.from('debtors').delete().eq('id', id);
  if (error) throw new Error('Could not delete the debtor.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'customer.deleted',
    module: 'Customers',
    entityType: 'debtor',
    entityId: id,
    entityLabel: debtor?.customer_name ?? id,
  });
}

export async function recordPayment(debtorId: string, amount: number, note?: string): Promise<void> {
  const profile = await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  if (amount <= 0) throw new Error('Payment amount must be greater than zero.');

  const { data: debtor } = await supabase.from('debtors').select('amount_owed, customer_name').eq('id', debtorId).single();
  if (!debtor) throw new Error('Debtor not found.');
  if (amount > Number(debtor.amount_owed)) {
    throw new Error("Payment amount can't exceed the outstanding balance.");
  }

  const { error } = await supabase.from('debtor_payments').insert({ org_id: profile.org_id, debtor_id: debtorId, amount, note: note?.trim() || null });
  if (error) throw new Error('Could not record the payment.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'customer.payment_recorded',
    module: 'Customers',
    entityType: 'debtor',
    entityId: debtorId,
    entityLabel: debtor.customer_name,
    newValue: { amount, note: note ?? null },
  });
}
