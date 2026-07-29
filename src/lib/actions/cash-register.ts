// Direct-Supabase equivalent of Inventra/lib/actions/cash-register.ts.
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/actions/audit';
import { notifyApprovers } from '@/lib/actions/notifications';

async function requireManagerProfile() {
  const profile = await requireProfile();
  if (!['owner', 'admin', 'manager'].includes(profile.role)) {
    throw new Error('Only an owner, admin, or manager can open or close the cash register.');
  }
  return profile;
}

async function requireAdminProfile() {
  const profile = await requireProfile();
  if (!['owner', 'admin'].includes(profile.role)) {
    throw new Error('Only an owner or admin can edit the opening balance.');
  }
  return profile;
}

function todayBusinessDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function cashSalesSoFar(orgId: string, warehouseId: string, businessDate: string): Promise<number> {
  const { data: sales } = await supabase
    .from('sales')
    .select('id')
    .eq('org_id', orgId)
    .eq('warehouse_id', warehouseId)
    .gte('created_at', businessDate)
    .lt('created_at', nextDate(businessDate));
  const saleIds = (sales ?? []).map((s) => s.id);
  if (saleIds.length === 0) return 0;

  const { data: payments } = await supabase.from('sale_payments').select('amount').eq('method', 'cash').in('sale_id', saleIds);
  return (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
}

export interface OpenCashRegisterInput {
  warehouseId: string;
  moneyAtHand: number;
  moneyInPurse: number;
}

export async function openCashRegister(input: OpenCashRegisterInput): Promise<string> {
  const profile = await requireManagerProfile();
  if (input.moneyAtHand < 0 || input.moneyInPurse < 0) throw new Error("Amounts can't be negative.");

  const { data: warehouse } = await supabase.from('warehouses').select('name').eq('id', input.warehouseId).maybeSingle();
  const businessDate = todayBusinessDate();
  const openingBalance = input.moneyAtHand + input.moneyInPurse;

  const { data, error } = await supabase
    .from('daily_cash_registers')
    .insert({
      org_id: profile.org_id,
      warehouse_id: input.warehouseId,
      business_date: businessDate,
      money_at_hand: input.moneyAtHand,
      money_in_purse: input.moneyInPurse,
      opening_balance: openingBalance,
      opened_by: profile.id,
    })
    .select('id')
    .single();
  if (error || !data) {
    if (error?.code === '23505') throw new Error('The cash register for this branch is already open today.');
    throw new Error('Could not open the cash register.');
  }

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'cash_register.opened',
    module: 'Cash Register',
    entityType: 'daily_cash_register',
    entityId: data.id as string,
    entityLabel: `${warehouse?.name ?? 'Branch'} — ${businessDate}`,
    newValue: { moneyAtHand: input.moneyAtHand, moneyInPurse: input.moneyInPurse, openingBalance },
  });

  return data.id as string;
}

export interface UpdateCashRegisterOpeningInput {
  moneyAtHand: number;
  moneyInPurse: number;
}

export async function updateCashRegisterOpening(id: string, input: UpdateCashRegisterOpeningInput): Promise<void> {
  const profile = await requireAdminProfile();
  if (input.moneyAtHand < 0 || input.moneyInPurse < 0) throw new Error("Amounts can't be negative.");

  const { data: before } = await supabase
    .from('daily_cash_registers')
    .select('status, money_at_hand, money_in_purse, warehouse_id, warehouses(name)')
    .eq('id', id)
    .maybeSingle();
  if (!before) throw new Error('Cash register entry not found.');
  if (before.status === 'closed') throw new Error("This day is already closed and can't be edited.");

  const openingBalance = input.moneyAtHand + input.moneyInPurse;
  const { error } = await supabase
    .from('daily_cash_registers')
    .update({ money_at_hand: input.moneyAtHand, money_in_purse: input.moneyInPurse, opening_balance: openingBalance })
    .eq('id', id);
  if (error) throw new Error('Could not update the opening balance.');

  const branchName = (before.warehouses as unknown as { name: string } | null)?.name;
  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'cash_register.opening_edited',
    module: 'Cash Register',
    entityType: 'daily_cash_register',
    entityId: id,
    entityLabel: branchName,
    newValue: {
      previousMoneyAtHand: before.money_at_hand,
      previousMoneyInPurse: before.money_in_purse,
      moneyAtHand: input.moneyAtHand,
      moneyInPurse: input.moneyInPurse,
      openingBalance,
    },
  });
}

export interface CloseCashRegisterInput {
  otherCashIncome: number;
  cashExpenses: number;
  cashWithdrawals: number;
  actualCashCount: number;
  notes?: string;
}

export interface CloseCashRegisterResult {
  expectedClosingBalance: number;
  difference: number;
}

export async function closeCashRegister(id: string, input: CloseCashRegisterInput): Promise<CloseCashRegisterResult> {
  const profile = await requireManagerProfile();
  if ([input.otherCashIncome, input.cashExpenses, input.cashWithdrawals, input.actualCashCount].some((n) => n < 0)) {
    throw new Error("Amounts can't be negative.");
  }

  const { data: register } = await supabase
    .from('daily_cash_registers')
    .select('status, opening_balance, warehouse_id, business_date, warehouses(name)')
    .eq('id', id)
    .maybeSingle();
  if (!register) throw new Error('Cash register entry not found.');
  if (register.status === 'closed') throw new Error('This day is already closed.');

  const cashSales = await cashSalesSoFar(profile.org_id, register.warehouse_id, register.business_date);
  const expectedClosingBalance = Number(register.opening_balance) + cashSales + input.otherCashIncome - input.cashExpenses - input.cashWithdrawals;
  const difference = input.actualCashCount - expectedClosingBalance;

  const { error } = await supabase
    .from('daily_cash_registers')
    .update({
      status: 'closed',
      cash_sales: cashSales,
      other_cash_income: input.otherCashIncome,
      cash_expenses: input.cashExpenses,
      cash_withdrawals: input.cashWithdrawals,
      expected_closing_balance: expectedClosingBalance,
      actual_cash_count: input.actualCashCount,
      difference,
      notes: input.notes?.trim() || null,
      closed_by: profile.id,
      closed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error('Could not close the cash register.');

  const branchName = (register.warehouses as unknown as { name: string } | null)?.name ?? 'Branch';
  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'cash_register.closed',
    module: 'Cash Register',
    entityType: 'daily_cash_register',
    entityId: id,
    entityLabel: `${branchName} — ${register.business_date}`,
    newValue: { expectedClosingBalance, actualCashCount: input.actualCashCount, difference },
  });

  if (difference !== 0) {
    void notifyApprovers({
      orgId: profile.org_id,
      excludeUserId: profile.id,
      type: 'cash_discrepancy',
      title: `⚠ Cash difference at ${branchName}`,
      body: `${difference > 0 ? 'Overage' : 'Shortage'} of ${Math.abs(difference).toFixed(2)} detected closing ${register.business_date}.`,
      entityType: 'daily_cash_register',
      entityId: id,
    });
  } else {
    void notifyApprovers({
      orgId: profile.org_id,
      excludeUserId: profile.id,
      type: 'cash_register_closed',
      title: `✅ ${branchName} closed and balanced`,
      body: `Business day ${register.business_date} closed with no discrepancy.`,
      entityType: 'daily_cash_register',
      entityId: id,
    });
  }

  return { expectedClosingBalance, difference };
}
