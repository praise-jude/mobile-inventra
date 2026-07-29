// Direct-Supabase equivalent of Inventra/lib/actions/expenses.ts.
import { logAudit } from '@/lib/actions/audit';
import { canAddExpense, UpgradeRequiredError } from '@/lib/entitlements';
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
  if (!(await canAddExpense())) {
    throw new UpgradeRequiredError("You've reached your Free Plan limit of 10 expenses. Upgrade to Premium for unlimited expenses.");
  }
  if (input.amount <= 0) throw new Error('Amount must be greater than zero.');

  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      org_id: profile.org_id,
      category: input.category,
      description: input.description?.trim() || null,
      amount: input.amount,
      incurred_at: input.incurredAt,
    })
    .select('id')
    .single();
  if (error) throw new Error('Could not create the expense.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'expense.created',
    module: 'Expenses',
    entityType: 'expense',
    entityId: expense.id as string,
    entityLabel: input.category,
    newValue: { category: input.category, amount: input.amount, incurredAt: input.incurredAt },
  });
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const profile = await requireManagerProfile();
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

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'expense.updated',
    module: 'Expenses',
    entityType: 'expense',
    entityId: id,
    entityLabel: input.category,
    newValue: { category: input.category, amount: input.amount, incurredAt: input.incurredAt },
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const profile = await requireManagerProfile();
  const { data: expense } = await supabase.from('expenses').select('category, amount').eq('id', id).maybeSingle();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error('Could not delete the expense.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'expense.deleted',
    module: 'Expenses',
    entityType: 'expense',
    entityId: id,
    entityLabel: expense?.category ?? id,
  });
}
