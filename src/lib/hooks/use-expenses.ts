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

export interface ExpensesOverview {
  dailyTotal: number;
  weeklyTotal: number;
  monthlyTotal: number;
  expenses: ExpenseRow[];
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
function dateKeyInTz(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function orgTimezone(userId: string): Promise<string> {
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', userId).single();
  if (!profile) return 'America/New_York';
  const { data: org } = await supabase.from('organizations').select('timezone').eq('id', profile.org_id).single();
  return org?.timezone ?? 'America/New_York';
}

// Mirrors Inventra/lib/queries/expenses.ts's getExpensesOverview — the
// day-by-day `trend` array is dropped since mobile has no charting library
// installed; the totals + list below cover the CRUD surface web has.
export function useExpensesOverview() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['expenses-overview', session?.user.id],
    queryFn: async (): Promise<ExpensesOverview> => {
      const timezone = await orgTimezone(session!.user.id);
      const since = dateKeyInTz(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), timezone);

      const { data, error } = await supabase
        .from('expenses')
        .select('id, category, description, amount, incurred_at')
        .gte('incurred_at', since)
        .order('incurred_at', { ascending: false });
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

      return {
        dailyTotal,
        weeklyTotal,
        monthlyTotal,
        expenses: rows.map((e) => ({
          id: e.id,
          category: e.category,
          description: e.description,
          amount: Number(e.amount),
          incurredAt: e.incurred_at,
        })),
      };
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
