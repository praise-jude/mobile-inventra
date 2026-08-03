import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { closeCashRegister, openCashRegister, updateCashRegisterOpening } from '@/lib/actions/cash-register';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useTodaysCashRegister } from '@/lib/hooks/use-cash-register';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useWarehouseOptions } from '@/lib/hooks/use-warehouse-options';
import { isAdminRole, isManagerRole } from '@/lib/roles';
import { useQueryClient } from '@tanstack/react-query';

// Mirrors Inventra/components/cash-register/CashRegisterClient.tsx — History
// is its own screen here (history.tsx) rather than a section below, matching
// how audit-log is a separate screen from other Manager-tier+ modules.
export default function CashRegisterScreen() {
  const queryClient = useQueryClient();
  const currency = useOrgCurrency();
  const profileQuery = useMyProfile();
  const isManager = isManagerRole(profileQuery.data?.role ?? '');
  const isAdmin = isAdminRole(profileQuery.data?.role ?? '');

  const branchesQuery = useWarehouseOptions();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const branchId = selectedBranchId ?? branchesQuery.data?.[0]?.id ?? null;

  const todayQuery = useTodaysCashRegister(branchId);

  const [openForm, setOpenForm] = useState({ moneyAtHand: '', moneyInPurse: '' });
  const [opening, setOpening] = useState(false);

  const [editingOpen, setEditingOpen] = useState(false);
  const [editForm, setEditForm] = useState({ moneyAtHand: '', moneyInPurse: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const [closeForm, setCloseForm] = useState({ otherCashIncome: '0', cashExpenses: '0', cashWithdrawals: '0', actualCashCount: '', notes: '' });
  const [closing, setClosing] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['cash-register-today', branchId] });
    queryClient.invalidateQueries({ queryKey: ['cash-register-history'] });
  }

  async function handleOpen() {
    if (!branchId) return;
    setOpening(true);
    try {
      await openCashRegister({ warehouseId: branchId, moneyAtHand: Number(openForm.moneyAtHand) || 0, moneyInPurse: Number(openForm.moneyInPurse) || 0 });
      haptics.success();
      invalidate();
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not open the cash register.');
    } finally {
      setOpening(false);
    }
  }

  function startEditOpening() {
    if (!todayQuery.data?.register) return;
    setEditForm({ moneyAtHand: String(todayQuery.data.register.moneyAtHand), moneyInPurse: String(todayQuery.data.register.moneyInPurse) });
    setEditingOpen(true);
  }

  async function handleSaveEdit() {
    if (!todayQuery.data?.register) return;
    setSavingEdit(true);
    try {
      await updateCashRegisterOpening(todayQuery.data.register.id, { moneyAtHand: Number(editForm.moneyAtHand) || 0, moneyInPurse: Number(editForm.moneyInPurse) || 0 });
      haptics.success();
      setEditingOpen(false);
      invalidate();
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not update the opening balance.');
    } finally {
      setSavingEdit(false);
    }
  }

  const liveExpected = todayQuery.data?.register
    ? todayQuery.data.register.openingBalance +
      todayQuery.data.cashSalesSoFar +
      (Number(closeForm.otherCashIncome) || 0) -
      (Number(closeForm.cashExpenses) || 0) -
      (Number(closeForm.cashWithdrawals) || 0)
    : 0;

  function handleClose() {
    if (!todayQuery.data?.register) return;
    if (!closeForm.actualCashCount) {
      notifyAlert('Missing count', 'Enter the actual cash count first.');
      return;
    }
    confirmAlert('Close business day?', `Expected closing balance: ${formatMoney(liveExpected, currency)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        onPress: async () => {
          setClosing(true);
          try {
            await closeCashRegister(todayQuery.data!.register!.id, {
              otherCashIncome: Number(closeForm.otherCashIncome) || 0,
              cashExpenses: Number(closeForm.cashExpenses) || 0,
              cashWithdrawals: Number(closeForm.cashWithdrawals) || 0,
              actualCashCount: Number(closeForm.actualCashCount) || 0,
              notes: closeForm.notes,
            });
            haptics.success();
            invalidate();
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not close the cash register.');
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  }

  const loading = branchesQuery.isLoading || (!!branchId && todayQuery.isLoading);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Cash Register</Text>
        {isManager ? (
          <Pressable onPress={() => router.push('/cash-register/history')} hitSlop={10}>
            <Text className="text-[13px] font-semibold text-accent-text dark:text-accent-text-dark">History</Text>
          </Pressable>
        ) : (
          <View className="w-12" />
        )}
      </View>

      {loading ? (
        <View className="gap-2.5 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] w-full" />
          ))}
        </View>
      ) : branchesQuery.data && branchesQuery.data.length === 0 ? (
        <EmptyState icon="🏬" title="No branches yet" description="Add a branch under Settings before opening a cash register." />
      ) : todayQuery.isError ? (
        <ErrorState onRetry={() => todayQuery.refetch()} />
      ) : (
        <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
          {branchesQuery.data && branchesQuery.data.length > 1 && branchId && (
            <SelectField
              label="Branch"
              value={branchId}
              options={branchesQuery.data.map((b) => ({ label: b.name, value: b.id }))}
              onChange={setSelectedBranchId}
            />
          )}

          {!todayQuery.data?.register ? (
            isManager ? (
              <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
                <Text className="mb-3.5 text-[15px] font-bold text-text dark:text-text-dark">Open business day</Text>
                <View className="gap-2.5">
                  <TextField label="Money at hand" value={openForm.moneyAtHand} onChangeText={(v) => setOpenForm((f) => ({ ...f, moneyAtHand: v }))} keyboardType="numeric" />
                  <TextField label="Money in purse / drawer" value={openForm.moneyInPurse} onChangeText={(v) => setOpenForm((f) => ({ ...f, moneyInPurse: v }))} keyboardType="numeric" />
                </View>
                <Text className="mb-3.5 mt-2.5 text-[12.5px] text-muted dark:text-muted-dark">
                  Opening balance: <Text className="font-bold text-text dark:text-text-dark">{formatMoney((Number(openForm.moneyAtHand) || 0) + (Number(openForm.moneyInPurse) || 0), currency)}</Text>
                </Text>
                <Button loading={opening} onPress={handleOpen}>
                  Open business day
                </Button>
              </View>
            ) : (
              <EmptyState icon="🔴" title="Business day not opened yet" description="Ask a manager or admin to open the cash register for today." />
            )
          ) : (
            <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <View className="mb-3.5 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className={`h-2.5 w-2.5 rounded-full ${todayQuery.data.register.status === 'open' ? 'bg-green dark:bg-green-dark' : 'bg-muted dark:bg-muted-dark'}`} />
                  <Text className="text-[15px] font-bold text-text dark:text-text-dark">
                    {todayQuery.data.register.status === 'open' ? 'Business day open' : 'Business day closed'}
                  </Text>
                </View>
                {isAdmin && todayQuery.data.register.status === 'open' && !editingOpen && (
                  <Pressable onPress={startEditOpening}>
                    <Text className="text-[12.5px] font-semibold text-accent-text dark:text-accent-text-dark">Edit opening</Text>
                  </Pressable>
                )}
              </View>

              {editingOpen ? (
                <View className="mb-3.5 gap-2.5">
                  <TextField label="Money at hand" value={editForm.moneyAtHand} onChangeText={(v) => setEditForm((f) => ({ ...f, moneyAtHand: v }))} keyboardType="numeric" />
                  <TextField label="Money in purse" value={editForm.moneyInPurse} onChangeText={(v) => setEditForm((f) => ({ ...f, moneyInPurse: v }))} keyboardType="numeric" />
                  <View className="flex-row gap-2">
                    <Button variant="secondary" onPress={() => setEditingOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button loading={savingEdit} onPress={handleSaveEdit} className="flex-1">
                      Save
                    </Button>
                  </View>
                </View>
              ) : (
                <View className="mb-3.5 flex-row flex-wrap gap-3">
                  <View className="min-w-[45%] flex-1">
                    <Text className="text-[10.5px] text-muted dark:text-muted-dark">Opening balance</Text>
                    <Text className="text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(todayQuery.data.register.openingBalance, currency)}</Text>
                  </View>
                  <View className="min-w-[45%] flex-1">
                    <Text className="text-[10.5px] text-muted dark:text-muted-dark">Cash sales {todayQuery.data.register.status === 'open' ? 'so far' : ''}</Text>
                    <Text className="text-[17px] font-bold text-text dark:text-text-dark">
                      {formatMoney(todayQuery.data.register.status === 'open' ? todayQuery.data.cashSalesSoFar : todayQuery.data.register.cashSales ?? 0, currency)}
                    </Text>
                  </View>
                  {todayQuery.data.register.status === 'open' && (
                    <View className="min-w-[45%] flex-1">
                      <Text className="text-[10.5px] text-muted dark:text-muted-dark">Total sales so far</Text>
                      <Text className="text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(todayQuery.data.totalSalesSoFar, currency)}</Text>
                    </View>
                  )}
                  {todayQuery.data.register.status === 'closed' && (
                    <>
                      <View className="min-w-[45%] flex-1">
                        <Text className="text-[10.5px] text-muted dark:text-muted-dark">Expected closing</Text>
                        <Text className="text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(todayQuery.data.register.expectedClosingBalance ?? 0, currency)}</Text>
                      </View>
                      <View className="min-w-[45%] flex-1">
                        <Text className="text-[10.5px] text-muted dark:text-muted-dark">Actual count</Text>
                        <Text className="text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(todayQuery.data.register.actualCashCount ?? 0, currency)}</Text>
                      </View>
                    </>
                  )}
                </View>
              )}

              {todayQuery.data.register.status === 'closed' && todayQuery.data.register.difference !== null && (
                <View className={`mb-3.5 rounded-[10px] px-3.5 py-2.5 ${todayQuery.data.register.difference === 0 ? 'bg-green-weak dark:bg-green-weak-dark' : 'bg-red-weak dark:bg-red-weak-dark'}`}>
                  <Text className={`text-[13px] font-semibold ${todayQuery.data.register.difference === 0 ? 'text-green dark:text-green-dark' : 'text-red dark:text-red-dark'}`}>
                    {todayQuery.data.register.difference === 0
                      ? '✅ Cash balanced'
                      : `⚠ ${todayQuery.data.register.difference > 0 ? 'Overage' : 'Shortage'} of ${formatMoney(Math.abs(todayQuery.data.register.difference), currency)}`}
                  </Text>
                </View>
              )}

              {isManager && todayQuery.data.register.status === 'open' && (
                <View className="border-t border-border pt-3.5 dark:border-border-dark">
                  <Text className="mb-2.5 text-[13px] font-bold text-text dark:text-text-dark">Close business day</Text>
                  <View className="gap-2.5">
                    <TextField label="Other cash income" value={closeForm.otherCashIncome} onChangeText={(v) => setCloseForm((f) => ({ ...f, otherCashIncome: v }))} keyboardType="numeric" />
                    <TextField label="Cash expenses" value={closeForm.cashExpenses} onChangeText={(v) => setCloseForm((f) => ({ ...f, cashExpenses: v }))} keyboardType="numeric" />
                    <TextField label="Cash withdrawals" value={closeForm.cashWithdrawals} onChangeText={(v) => setCloseForm((f) => ({ ...f, cashWithdrawals: v }))} keyboardType="numeric" />
                    <TextField label="Actual cash count" value={closeForm.actualCashCount} onChangeText={(v) => setCloseForm((f) => ({ ...f, actualCashCount: v }))} keyboardType="numeric" />
                    <TextField label="Notes (optional)" value={closeForm.notes} onChangeText={(v) => setCloseForm((f) => ({ ...f, notes: v }))} />
                  </View>
                  <Text className="mb-3 mt-2.5 text-[12.5px] text-muted dark:text-muted-dark">
                    Expected closing balance: <Text className="font-bold text-text dark:text-text-dark">{formatMoney(liveExpected, currency)}</Text>
                  </Text>
                  <Button loading={closing} onPress={handleClose}>
                    Close business day
                  </Button>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
