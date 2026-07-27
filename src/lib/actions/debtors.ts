// Direct-Supabase equivalent of Inventra/lib/actions/debtors.ts. Customer
// management is a full Premium lock (canManageCustomers()), not a
// free-tier count limit — matches RLS on debtors/debtor_payments, which
// blocks select/insert/update/delete entirely for Free-tier orgs.
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
  dateOfBirth?: string;
}

export async function createDebtor(input: DebtorInput): Promise<void> {
  const profile = await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  const customerName = input.customerName.trim();
  if (!customerName) throw new Error('Customer name is required.');
  if (input.amountOwed < 0) throw new Error("Amount owed can't be negative.");

  const { error } = await supabase.from('debtors').insert({
    org_id: profile.org_id,
    customer_name: customerName,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    amount_owed: input.amountOwed,
    due_date: input.dueDate || null,
    notes: input.notes?.trim() || null,
    date_of_birth: input.dateOfBirth || null,
  });
  if (error) throw new Error('Could not create the debtor.');
}

export async function updateDebtor(id: string, input: DebtorInput & { status?: DebtorStatus }): Promise<void> {
  await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  const customerName = input.customerName.trim();
  if (!customerName) throw new Error('Customer name is required.');

  const patch: Partial<Pick<Debtor, 'customer_name' | 'phone' | 'email' | 'notes' | 'due_date' | 'status' | 'date_of_birth'>> = {
    customer_name: customerName,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    due_date: input.dueDate || null,
    notes: input.notes?.trim() || null,
    date_of_birth: input.dateOfBirth || null,
  };
  if (input.status) patch.status = input.status;

  const { error } = await supabase.from('debtors').update(patch).eq('id', id);
  if (error) throw new Error('Could not update the debtor.');
}

export async function updateDebtorStatus(id: string, status: DebtorStatus): Promise<void> {
  await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  const { error } = await supabase.from('debtors').update({ status }).eq('id', id);
  if (error) throw new Error("Could not update the debtor's status.");
}

export async function deleteDebtor(id: string): Promise<void> {
  const profile = await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  if (!['owner', 'admin'].includes(profile.role)) {
    throw new Error('Only an owner or admin can delete a debtor.');
  }

  const { error } = await supabase.from('debtors').delete().eq('id', id);
  if (error) throw new Error('Could not delete the debtor.');
}

export async function recordPayment(debtorId: string, amount: number, note?: string): Promise<void> {
  const profile = await requireProfile();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError('Customer management is a Premium feature. Upgrade to Premium to track customer credit.');
  }
  if (amount <= 0) throw new Error('Payment amount must be greater than zero.');

  const { data: debtor } = await supabase.from('debtors').select('amount_owed').eq('id', debtorId).single();
  if (!debtor) throw new Error('Debtor not found.');
  if (amount > Number(debtor.amount_owed)) {
    throw new Error("Payment amount can't exceed the outstanding balance.");
  }

  const { error } = await supabase.from('debtor_payments').insert({ org_id: profile.org_id, debtor_id: debtorId, amount, note: note?.trim() || null });
  if (error) throw new Error('Could not record the payment.');
}
