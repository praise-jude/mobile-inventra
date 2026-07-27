import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { DebtorStatus } from '@/types/database';

// Nothing in the DB flips a debtor to 'overdue' when its due_date passes —
// derive it at read time, mirroring Inventra/lib/queries/debtors.ts's
// effectiveStatus exactly, so the badge/total stay honest without a cron.
function effectiveStatus(status: DebtorStatus, dueDate: string | null): DebtorStatus {
  if ((status === 'pending' || status === 'partially_paid') && dueDate && dueDate < new Date().toISOString().slice(0, 10)) {
    return 'overdue';
  }
  return status;
}

// Days until the next occurrence of a date_of_birth's month/day (ignores
// year — this is a recurring anniversary, not an age calculation). Returns
// null for no birthday on file.
export function daysUntilBirthday(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export type CustomerSegment = 'new' | 'high_value' | 'overdue' | 'paid_up' | 'standard';

export interface DebtorRow {
  id: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  amountOwed: number;
  dueDate: string | null;
  status: DebtorStatus;
  dateOfBirth: string | null;
  createdAt: string;
}

export interface DebtorsOverview {
  totalOutstanding: number;
  totalPaid: number;
  overdueAmount: number;
  debtorCount: number;
  debtors: DebtorRow[];
}

// Mirrors Inventra/lib/queries/debtors.ts's getDebtorsOverview.
export function useDebtorsOverview() {
  return useQuery({
    queryKey: ['debtors-overview'],
    queryFn: async (): Promise<DebtorsOverview> => {
      const [{ data: debtors, error: debError }, { data: totalPaidRaw, error: payError }] = await Promise.all([
        supabase
          .from('debtors')
          .select('id, customer_name, phone, email, notes, amount_owed, due_date, status, date_of_birth, created_at')
          .order('created_at', { ascending: false }),
        supabase.rpc('get_debtor_payments_total'),
      ]);
      if (debError) throw new Error('Could not load debtors.');
      if (payError) throw new Error('Could not load debtors.');

      const rows = (debtors ?? []).map((d) => ({ ...d, status: effectiveStatus(d.status, d.due_date) }));
      const totalOutstanding = rows.filter((d) => d.status !== 'cancelled').reduce((s, d) => s + Number(d.amount_owed), 0);
      const overdueAmount = rows.filter((d) => d.status === 'overdue').reduce((s, d) => s + Number(d.amount_owed), 0);

      return {
        totalOutstanding,
        totalPaid: Number(totalPaidRaw ?? 0),
        overdueAmount,
        debtorCount: rows.length,
        debtors: rows.map((d) => ({
          id: d.id,
          customerName: d.customer_name,
          phone: d.phone,
          email: d.email,
          notes: d.notes,
          amountOwed: Number(d.amount_owed),
          dueDate: d.due_date,
          status: d.status,
          dateOfBirth: d.date_of_birth,
          createdAt: d.created_at,
        })),
      };
    },
  });
}

// Segments each debtor relative to the rest of the org's own list (not a
// hardcoded currency amount, since that wouldn't mean the same thing for
// an org billing in NGN vs one billing in USD) — top 20% by amount owed is
// "high value", everything else falls through status/recency rules.
export function segmentFor(debtor: DebtorRow, allAmounts: number[]): CustomerSegment {
  if (debtor.status === 'overdue') return 'overdue';
  if (debtor.status === 'paid') return 'paid_up';
  const isNew = Date.now() - new Date(debtor.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000;
  if (isNew) return 'new';
  if (allAmounts.length >= 3) {
    const sorted = [...allAmounts].sort((a, b) => b - a);
    const top20Threshold = sorted[Math.max(0, Math.floor(sorted.length * 0.2) - 1)];
    if (debtor.amountOwed > 0 && debtor.amountOwed >= top20Threshold) return 'high_value';
  }
  return 'standard';
}

export interface DebtorPaymentRow {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
}

export interface DebtorDetail extends DebtorRow {
  payments: DebtorPaymentRow[];
  lifetimeValue: number;
}

// Mirrors Inventra/lib/queries/debtors.ts's getDebtorDetail.
export function useDebtorDetail(id: string | null) {
  return useQuery({
    queryKey: ['debtor-detail', id],
    queryFn: async (): Promise<DebtorDetail> => {
      const { data: debtor, error: debError } = await supabase
        .from('debtors')
        .select('id, customer_name, phone, email, notes, amount_owed, due_date, status, date_of_birth, created_at')
        .eq('id', id!)
        .single();
      if (debError || !debtor) throw new Error('Could not load this debtor.');

      const { data: payments, error: payError } = await supabase
        .from('debtor_payments')
        .select('id, amount, paid_at, note')
        .eq('debtor_id', id!)
        .order('paid_at', { ascending: false });
      if (payError) throw new Error("Could not load this debtor's payment history.");

      const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        id: debtor.id,
        customerName: debtor.customer_name,
        phone: debtor.phone,
        email: debtor.email,
        notes: debtor.notes,
        amountOwed: Number(debtor.amount_owed),
        dueDate: debtor.due_date,
        status: effectiveStatus(debtor.status, debtor.due_date),
        dateOfBirth: debtor.date_of_birth,
        createdAt: debtor.created_at,
        // Lifetime value = everything ever paid plus what's currently
        // still owed — the full relationship value, not just the open
        // balance.
        lifetimeValue: totalPaid + Number(debtor.amount_owed),
        payments: (payments ?? []).map((p) => ({ id: p.id, amount: Number(p.amount), paidAt: p.paid_at, note: p.note })),
      };
    },
    enabled: !!id,
  });
}
