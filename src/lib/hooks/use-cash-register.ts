import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Mirrors Inventra/lib/queries/cash-register.ts.
export type CashRegisterStatus = 'open' | 'closed';

export interface CashRegisterRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  businessDate: string;
  status: CashRegisterStatus;
  moneyAtHand: number;
  moneyInPurse: number;
  openingBalance: number;
  cashSales: number | null;
  otherCashIncome: number;
  cashExpenses: number;
  cashWithdrawals: number;
  expectedClosingBalance: number | null;
  actualCashCount: number | null;
  difference: number | null;
  notes: string | null;
  closedByName: string | null;
  closedAt: string | null;
}

function mapRow(r: any): CashRegisterRow {
  return {
    id: r.id,
    warehouseId: r.warehouse_id,
    warehouseName: r.warehouses?.name ?? 'Branch',
    businessDate: r.business_date,
    status: r.status,
    moneyAtHand: Number(r.money_at_hand),
    moneyInPurse: Number(r.money_in_purse),
    openingBalance: Number(r.opening_balance),
    cashSales: r.cash_sales !== null ? Number(r.cash_sales) : null,
    otherCashIncome: Number(r.other_cash_income),
    cashExpenses: Number(r.cash_expenses),
    cashWithdrawals: Number(r.cash_withdrawals),
    expectedClosingBalance: r.expected_closing_balance !== null ? Number(r.expected_closing_balance) : null,
    actualCashCount: r.actual_cash_count !== null ? Number(r.actual_cash_count) : null,
    difference: r.difference !== null ? Number(r.difference) : null,
    notes: r.notes,
    closedByName: r.closed_by_profile ? `${r.closed_by_profile.first_name} ${r.closed_by_profile.last_name}` : null,
    closedAt: r.closed_at,
  };
}

const SELECT_COLUMNS =
  'id, warehouse_id, business_date, status, money_at_hand, money_in_purse, opening_balance, cash_sales, other_cash_income, cash_expenses, cash_withdrawals, expected_closing_balance, actual_cash_count, difference, notes, closed_at, warehouses(name), closed_by_profile:closed_by(first_name, last_name)';

function todayBusinessDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface TodaysCashRegister {
  register: CashRegisterRow | null;
  cashSalesSoFar: number;
  totalSalesSoFar: number;
}

// Same computation as src/lib/actions/cash-register.ts's closeCashRegister
// — the Close Day preview and the actual close never disagree.
export function useTodaysCashRegister(warehouseId: string | null) {
  return useQuery({
    queryKey: ['cash-register-today', warehouseId],
    queryFn: async (): Promise<TodaysCashRegister> => {
      const businessDate = todayBusinessDate();
      const { data, error } = await supabase
        .from('daily_cash_registers')
        .select(SELECT_COLUMNS)
        .eq('warehouse_id', warehouseId!)
        .eq('business_date', businessDate)
        .maybeSingle();
      if (error) throw new Error("Could not load today's cash register.");

      const register = data ? mapRow(data) : null;
      if (!register || register.status !== 'open') {
        return { register, cashSalesSoFar: register?.cashSales ?? 0, totalSalesSoFar: 0 };
      }

      const { data: sales } = await supabase
        .from('sales')
        .select('id, total')
        .eq('warehouse_id', warehouseId!)
        .gte('created_at', businessDate)
        .lt('created_at', nextDate(businessDate));
      const rows = sales ?? [];
      const totalSalesSoFar = rows.reduce((sum, s) => sum + Number(s.total), 0);

      let cashSalesSoFar = 0;
      if (rows.length > 0) {
        const { data: payments } = await supabase
          .from('sale_payments')
          .select('amount')
          .eq('method', 'cash')
          .in(
            'sale_id',
            rows.map((s) => s.id),
          );
        cashSalesSoFar = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
      }

      return { register, cashSalesSoFar, totalSalesSoFar };
    },
    enabled: !!warehouseId,
  });
}

export function useCashRegisterHistory(warehouseId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['cash-register-history', warehouseId, from, to],
    queryFn: async (): Promise<CashRegisterRow[]> => {
      const { data, error } = await supabase
        .from('daily_cash_registers')
        .select(SELECT_COLUMNS)
        .eq('warehouse_id', warehouseId!)
        .gte('business_date', from)
        .lte('business_date', to)
        .order('business_date', { ascending: false });
      if (error) throw new Error('Could not load cash register history.');
      return (data ?? []).map(mapRow);
    },
    enabled: !!warehouseId,
  });
}
