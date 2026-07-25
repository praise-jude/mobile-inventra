import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { deleteExpense, updateExpense } from '@/lib/actions/expenses';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { CATEGORY_LABEL, useExpenseCategoryBreakdown, useExpensesOverview, type ExpenseRow } from '@/lib/hooks/use-expenses';
import { useOrgCurrency } from '@/lib/hooks/use-org-currency';
import { useQueryClient } from '@tanstack/react-query';
import { SelectField } from '@/components/ui/select-field';
import type { ExpenseCategory } from '@/types/database';

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => ({ label: CATEGORY_LABEL[c], value: c }));

// Mirrors Inventra/components/expenses/ExpensesClient.tsx (day-by-day trend
// chart dropped — no charting library on mobile; totals + breakdown + list
// cover the CRUD surface).
export default function ExpensesScreen() {
  const queryClient = useQueryClient();
  const currency = useOrgCurrency();
  const overviewQuery = useExpensesOverview();
  const breakdownQuery = useExpenseCategoryBreakdown();
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['expenses-overview'] });
    queryClient.invalidateQueries({ queryKey: ['expense-category-breakdown'] });
  }

  function handleDelete(expense: ExpenseRow) {
    confirmAlert('Delete this expense?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(expense.id);
          try {
            await deleteExpense(expense.id);
            haptics.success();
            invalidate();
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not delete this expense.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Expenses</Text>
        <View className="w-12" />
      </View>

      {overviewQuery.isLoading ? (
        <View className="gap-2.5 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] w-full" />
          ))}
        </View>
      ) : overviewQuery.isError ? (
        <ErrorState onRetry={() => overviewQuery.refetch()} />
      ) : (
        <ScrollView contentContainerClassName="gap-3.5 p-4">
          <View className="flex-row gap-2.5">
            <View className="flex-1 rounded-2xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[10.5px] text-muted dark:text-muted-dark">Today</Text>
              <Text className="text-[14px] font-bold text-text dark:text-text-dark">{formatMoney(overviewQuery.data!.dailyTotal, currency)}</Text>
            </View>
            <View className="flex-1 rounded-2xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[10.5px] text-muted dark:text-muted-dark">This week</Text>
              <Text className="text-[14px] font-bold text-text dark:text-text-dark">{formatMoney(overviewQuery.data!.weeklyTotal, currency)}</Text>
            </View>
            <View className="flex-1 rounded-2xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[10.5px] text-muted dark:text-muted-dark">This month</Text>
              <Text className="text-[14px] font-bold text-text dark:text-text-dark">{formatMoney(overviewQuery.data!.monthlyTotal, currency)}</Text>
            </View>
          </View>

          <Button onPress={() => router.push('/expenses/new')} className="self-start px-4">
            + New expense
          </Button>

          {(breakdownQuery.data ?? []).length > 0 && (
            <View className="gap-2 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[12.5px] font-bold text-text dark:text-text-dark">Last 30 days by category</Text>
              {breakdownQuery.data!.map((b) => (
                <View key={b.category} className="flex-row items-center justify-between">
                  <Text className="text-[12px] text-text-2 dark:text-text-2-dark">{b.label}</Text>
                  <Text className="text-[12px] font-semibold text-text dark:text-text-dark">
                    {formatMoney(b.amount, currency)} · {b.pct}%
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text className="text-[13px] font-bold text-text dark:text-text-dark">Recent expenses</Text>
          {overviewQuery.data!.expenses.length === 0 ? (
            <EmptyState icon="💸" title="No expenses yet" description="Log an expense to start tracking spend." />
          ) : (
            overviewQuery.data!.expenses.map((e) => (
              <View key={e.id} className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{CATEGORY_LABEL[e.category]}</Text>
                  <Text className="text-[13px] font-bold text-text dark:text-text-dark">{formatMoney(e.amount, currency)}</Text>
                </View>
                {e.description && <Text className="mt-0.5 text-[12px] text-text-2 dark:text-text-2-dark">{e.description}</Text>}
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-[11px] text-muted dark:text-muted-dark">{e.incurredAt}</Text>
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => setEditing(e)} className="rounded-[8px] border border-border px-2.5 py-1 dark:border-border-dark">
                      <Text className="text-[11.5px] font-semibold text-text dark:text-text-dark">Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(e)}
                      disabled={busyId === e.id}
                      className="rounded-[8px] border border-border px-2.5 py-1 dark:border-border-dark"
                    >
                      <Text className="text-[11.5px] font-semibold text-red dark:text-red-dark">Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {editing && (
        <ExpenseEditSheet
          expense={editing}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}
    </SafeAreaView>
  );
}

function ExpenseEditSheet({ expense, onClose, onSaved }: { expense: ExpenseRow; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const [description, setDescription] = useState(expense.description ?? '');
  const [amount, setAmount] = useState(String(expense.amount));
  const [incurredAt, setIncurredAt] = useState(expense.incurredAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateExpense(expense.id, { category, description, amount: Number(amount) || 0, incurredAt });
      haptics.success();
      onSaved();
      onClose();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not update this expense.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Pressable onPress={onClose} className="absolute inset-0 items-end justify-end bg-black/40">
      <Pressable onPress={(e) => e.stopPropagation()} className="w-full rounded-t-[20px] bg-surface p-5 pb-8 dark:bg-surface-dark">
        <Text className="mb-4 text-[15px] font-bold text-text dark:text-text-dark">Edit expense</Text>
        <View className="gap-3">
          <SelectField label="Category" value={category} options={CATEGORY_OPTIONS} onChange={(v) => setCategory(v as ExpenseCategory)} />
          <TextField label="Description (optional)" value={description} onChangeText={setDescription} />
          <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
          <TextField label="Date (YYYY-MM-DD)" value={incurredAt} onChangeText={setIncurredAt} />
          {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}
          <Button loading={saving} onPress={handleSave} className="mt-1">
            Save changes
          </Button>
        </View>
      </Pressable>
    </Pressable>
  );
}
