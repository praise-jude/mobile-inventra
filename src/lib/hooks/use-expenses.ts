import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { ExpenseCategory } from '@/types/database';

export interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  incurredAt: string;
}

export interface ExpensesTotals {
  dailyTotal: number;
  weeklyTotal: number;
  monthlyTotal: number;
}

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  salary: 'Salary',
  transport: 'Transport',
  utilities: 'Utilities',
  inventory_purchase: 'Inventory Purchase',
  logistics: 'Logistics',
  miscellaneous: 'Miscellaneous',
};

// Expenses.incurred_at is a plain `date` (no time component) — bucketing by
// day/week/month is timezone-agnostic except for determining what "today"
// actually is in the org's zone, mirroring Inventra/lib/queries/expenses.ts's
// dateKeyInTz exactly.
export function dateKeyInTz(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function orgTimezone(userId: string): Promise<string> {
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', userId).single();
  if (!profile) return 'America/New_York';
  const { data: org } = await supabase.from('organizations').select('timezone').eq('id', profile.org_id).single();
  return org?.timezone ?? 'America/New_York';
}

// Was one unbounded 90-day row fetch (id/category/description/amount for
// every expense, potentially hundreds on a busy org) used only to sum
// three totals — same class of gap Debtors/Team had. Split into this
// lightweight 2-column scan (mirrors Inventra/lib/queries/expenses.ts's
// getExpensesOverview totals) and useRecentExpenses below (bounded, for
// the actual "Recent expenses" list this screen shows).
export function useExpensesTotals() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['expenses-totals', session?.user.id],
    queryFn: async (): Promise<ExpensesTotals> => {
      const timezone = await orgTimezone(session!.user.id);
      const since = dateKeyInTz(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), timezone);

      const { data, error } = await supabase.from('expenses').select('amount, incurred_at').gte('incurred_at', since);
      if (error) throw new Error('Could not load expenses.');

      const rows = data ?? [];
      const today = dateKeyInTz(new Date(), timezone);
      const weekAgo = dateKeyInTz(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), timezone);
      const monthAgo = dateKeyInTz(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), timezone);

      let dailyTotal = 0;
      let weeklyTotal = 0;
      let monthlyTotal = 0;
      for (const e of rows) {
        const amount = Number(e.amount);
        if (e.incurred_at === today) dailyTotal += amount;
        if (e.incurred_at >= weekAgo) weeklyTotal += amount;
        if (e.incurred_at >= monthAgo) monthlyTotal += amount;
      }

      return { dailyTotal, weeklyTotal, monthlyTotal };
    },
    enabled: !!session,
  });
}

// Bounded to the most recent 20 — matches the "Recent expenses" framing
// this screen has always used (never meant to be the full 90-day list).
export function useRecentExpenses(limit = 20) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['recent-expenses', session?.user.id, limit],
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, category, description, amount, incurred_at')
        .order('incurred_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error('Could not load expenses.');
      return (data ?? []).map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        incurredAt: e.incurred_at,
      }));
    },
    enabled: !!session,
  });
}

export interface ExpenseCategoryBreakdown {
  category: ExpenseCategory;
  label: string;
  amount: number;
  pct: number;
}

// Mirrors Inventra/lib/queries/expenses.ts's getExpenseCategoryBreakdown.
export function useExpenseCategoryBreakdown() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['expense-category-breakdown', session?.user.id],
    queryFn: async (): Promise<ExpenseCategoryBreakdown[]> => {
      const timezone = await orgTimezone(session!.user.id);
      const since = dateKeyInTz(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), timezone);

      const { data, error } = await supabase.from('expenses').select('category, amount').gte('incurred_at', since);
      if (error) throw new Error('Could not load expense breakdown.');

      const totals = new Map<ExpenseCategory, number>();
      let grandTotal = 0;
      for (const row of data ?? []) {
        const amount = Number(row.amount);
        totals.set(row.category, (totals.get(row.category) ?? 0) + amount);
        grandTotal += amount;
      }

      return Array.from(totals.entries())
        .map(([category, amount]) => ({
          category,
          label: CATEGORY_LABEL[category],
          amount,
          pct: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);
    },
    enabled: !!session,
  });
}
