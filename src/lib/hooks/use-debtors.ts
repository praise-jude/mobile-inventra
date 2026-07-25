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

export interface DebtorRow {
  id: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  amountOwed: number;
  dueDate: string | null;
  status: DebtorStatus;
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
        supabase.from('debtors').select('id, customer_name, phone, email, notes, amount_owed, due_date, status').order('created_at', { ascending: false }),
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
        })),
      };
    },
  });
}

export interface DebtorPaymentRow {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
}

export interface DebtorDetail extends DebtorRow {
  payments: DebtorPaymentRow[];
}

// Mirrors Inventra/lib/queries/debtors.ts's getDebtorDetail.
export function useDebtorDetail(id: string | null) {
  return useQuery({
    queryKey: ['debtor-detail', id],
    queryFn: async (): Promise<DebtorDetail> => {
      const { data: debtor, error: debError } = await supabase
        .from('debtors')
        .select('id, customer_name, phone, email, notes, amount_owed, due_date, status')
        .eq('id', id!)
        .single();
      if (debError || !debtor) throw new Error('Could not load this debtor.');

      const { data: payments, error: payError } = await supabase
        .from('debtor_payments')
        .select('id, amount, paid_at, note')
        .eq('debtor_id', id!)
        .order('paid_at', { ascending: false });
      if (payError) throw new Error("Could not load this debtor's payment history.");

      return {
        id: debtor.id,
        customerName: debtor.customer_name,
        phone: debtor.phone,
        email: debtor.email,
        notes: debtor.notes,
        amountOwed: Number(debtor.amount_owed),
        dueDate: debtor.due_date,
        status: effectiveStatus(debtor.status, debtor.due_date),
        payments: (payments ?? []).map((p) => ({ id: p.id, amount: Number(p.amount), paidAt: p.paid_at, note: p.note })),
      };
    },
    enabled: !!id,
  });
}
