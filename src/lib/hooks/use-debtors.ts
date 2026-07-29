import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { DebtorStatus } from '@/types/database';

const PAGE_SIZE = 25;

// Nothing in the DB flips a debtor to 'overdue' when its due_date passes —
// derive it at read time, mirroring Inventra/lib/queries/debtors.ts's
// effectiveStatus exactly, so the badge/total stay honest without a cron.
function effectiveStatus(status: DebtorStatus, dueDate: string | null): DebtorStatus {
  if ((status === 'pending' || status === 'partially_paid') && dueDate && dueDate < new Date().toISOString().slice(0, 10)) {
    return 'overdue';
  }
  return status;
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
  createdAt: string;
}

export interface DebtorsTotals {
  totalOutstanding: number;
  totalPaid: number;
  overdueAmount: number;
  debtorCount: number;
  // Top-20%-by-amount-owed cutoff across every debtor in the org — same
  // basis segmentFor() below already used when everything was loaded at
  // once. Computed here (from a lightweight amount_owed-only scan) so the
  // "High value" segment filter can still be expressed as a single
  // .gte(amount_owed, threshold) on the paginated query, without needing
  // every debtor loaded client-side to know where that cutoff falls.
  highValueThreshold: number | null;
  // Top-10%/top-40% cutoffs for customers/[id].tsx's Gold/Silver/Bronze
  // loyalty badge — same three-percentile split it used to compute itself
  // from a full useDebtorsOverview() fetch; now sourced from this same
  // lightweight scan instead of a second unbounded one.
  goldThreshold: number | null;
  silverThreshold: number | null;
}

// Was folded into one unbounded useDebtorsOverview() fetch — split so the
// summary cards (which must reflect every debtor, not just a loaded page)
// and the actual list (now paginated, see useDebtorsList below) can be
// independent queries. Mirrors Inventra/lib/queries/debtors.ts's split
// between its totals scan and its paginated row query.
export function useDebtorsTotals() {
  return useQuery({
    queryKey: ['debtors-totals'],
    queryFn: async (): Promise<DebtorsTotals> => {
      const [{ data: rows, error: debError }, { data: totalPaidRaw, error: payError }] = await Promise.all([
        supabase.from('debtors').select('amount_owed, status, due_date'),
        supabase.rpc('get_debtor_payments_total'),
      ]);
      if (debError) throw new Error('Could not load debtors.');
      if (payError) throw new Error('Could not load debtors.');

      const withStatus = (rows ?? []).map((d) => ({ ...d, status: effectiveStatus(d.status, d.due_date) }));
      const totalOutstanding = withStatus.filter((d) => d.status !== 'cancelled').reduce((s, d) => s + Number(d.amount_owed), 0);
      const overdueAmount = withStatus.filter((d) => d.status === 'overdue').reduce((s, d) => s + Number(d.amount_owed), 0);

      const amounts = withStatus.map((d) => Number(d.amount_owed)).filter((a) => a > 0);
      let highValueThreshold: number | null = null;
      let goldThreshold: number | null = null;
      let silverThreshold: number | null = null;
      if (amounts.length >= 3) {
        const sorted = [...amounts].sort((a, b) => b - a);
        highValueThreshold = sorted[Math.max(0, Math.floor(sorted.length * 0.2) - 1)];
        goldThreshold = sorted[Math.max(0, Math.floor(sorted.length * 0.1) - 1)];
        silverThreshold = sorted[Math.max(0, Math.floor(sorted.length * 0.4) - 1)];
      }

      return {
        totalOutstanding,
        totalPaid: Number(totalPaidRaw ?? 0),
        overdueAmount,
        debtorCount: withStatus.length,
        highValueThreshold,
        goldThreshold,
        silverThreshold,
      };
    },
  });
}

export interface DebtorsListFilters {
  search?: string;
  status?: DebtorStatus;
  segment?: CustomerSegment | '';
}

// segmentFor() used to classify a row against every other loaded debtor —
// now that rows are paginated, "New" and "Paid up" translate to a direct
// column filter, "Overdue" mirrors effectiveStatus's own rule, and "High
// value" needs the org-wide threshold useDebtorsTotals() computed (passed
// in rather than recomputed here, so the two queries agree on one number).
// "Standard" (the catch-all bucket) isn't offered as a filter chip in the
// UI, so it isn't implemented as a query — same as before this change.
export function useDebtorsList(filters: DebtorsListFilters, highValueThreshold: number | null) {
  const needsThreshold = filters.segment === 'high_value';
  return useInfiniteQuery({
    queryKey: ['debtors-list', filters, highValueThreshold],
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('debtors')
        .select('id, customer_name, phone, email, notes, amount_owed, due_date, status, created_at', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters.search?.trim()) {
        const q = filters.search.trim().replace(/[%_]/g, '');
        query = query.or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.segment === 'overdue') {
        const today = new Date().toISOString().slice(0, 10);
        query = query.in('status', ['pending', 'partially_paid']).lt('due_date', today);
      } else if (filters.segment === 'paid_up') {
        query = query.eq('status', 'paid');
      } else if (filters.segment === 'new') {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', since);
      } else if (filters.segment === 'high_value' && highValueThreshold !== null) {
        query = query.gte('amount_owed', highValueThreshold);
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw new Error('Could not load debtors.');

      const rows: DebtorRow[] = (data ?? []).map((d) => ({
        id: d.id,
        customerName: d.customer_name,
        phone: d.phone,
        email: d.email,
        notes: d.notes,
        amountOwed: Number(d.amount_owed),
        dueDate: d.due_date,
        status: effectiveStatus(d.status, d.due_date),
        createdAt: d.created_at,
      }));
      return { rows, total: count ?? 0, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: !needsThreshold || highValueThreshold !== null,
  });
}

// Retained for anywhere still classifying an already-loaded row against a
// known threshold (e.g. a detail screen) — the org-wide-scan version this
// used to do alone now lives in useDebtorsTotals.
export function segmentFor(debtor: DebtorRow, highValueThreshold: number | null): CustomerSegment {
  if (debtor.status === 'overdue') return 'overdue';
  if (debtor.status === 'paid') return 'paid_up';
  const isNew = Date.now() - new Date(debtor.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000;
  if (isNew) return 'new';
  if (highValueThreshold !== null && debtor.amountOwed > 0 && debtor.amountOwed >= highValueThreshold) return 'high_value';
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
        .select('id, customer_name, phone, email, notes, amount_owed, due_date, status, created_at')
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
