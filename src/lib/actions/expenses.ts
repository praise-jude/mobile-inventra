// Direct-Supabase equivalent of Inventra/lib/actions/expenses.ts.
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { ExpenseCategory } from '@/types/database';

// Expenses are Manager-tier+ — expenses_rw RLS is fully open (any org
// member), so this is the real gate, matching web's requireManagerOrgId.
async function requireManagerProfile() {
  const profile = await requireProfile();
  if (!['owner', 'admin', 'manager'].includes(profile.role)) {
    throw new Error('Only an owner, admin, or manager can manage expenses.');
  }
  return profile;
}

export interface ExpenseInput {
  category: ExpenseCategory;
  description?: string;
  amount: number;
  incurredAt: string;
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const profile = await requireManagerProfile();
  if (input.amount <= 0) throw new Error('Amount must be greater than zero.');

  const { error } = await supabase.from('expenses').insert({
    org_id: profile.org_id,
    category: input.category,
    description: input.description?.trim() || null,
    amount: input.amount,
    incurred_at: input.incurredAt,
  });
  if (error) throw new Error('Could not create the expense.');
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  await requireManagerProfile();
  if (input.amount <= 0) throw new Error('Amount must be greater than zero.');

  const { error } = await supabase
    .from('expenses')
    .update({
      category: input.category,
      description: input.description?.trim() || null,
      amount: input.amount,
      incurred_at: input.incurredAt,
    })
    .eq('id', id);
  if (error) throw new Error('Could not update the expense.');
}

export async function deleteExpense(id: string): Promise<void> {
  await requireManagerProfile();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error('Could not delete the expense.');
}
