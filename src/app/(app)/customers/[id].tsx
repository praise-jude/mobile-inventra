import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { deleteDebtor, recordPayment, updateDebtor, type DebtorInput } from '@/lib/actions/debtors';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useDebtorDetail, useDebtorsOverview } from '@/lib/hooks/use-debtors';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org-currency';
import { isAdminRole } from '@/lib/roles';

// Merges Inventra/components/debtors/DebtorsClient.tsx's row-expand detail,
// edit modal, and record-payment modal into one screen for mobile.
export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const profileQuery = useMyProfile();
  const currency = useOrgCurrency();
  const query = useDebtorDetail(id ?? null);
  const overviewQuery = useDebtorsOverview();
  const canDelete = isAdminRole(profileQuery.data?.role ?? '');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Omit<DebtorInput, 'amountOwed'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payingAmount, setPayingAmount] = useState('');
  const [payingNote, setPayingNote] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);
  const [paying, setPaying] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['debtor-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['debtors-overview'] });
  }

  function startEdit() {
    if (!query.data) return;
    setForm({
      customerName: query.data.customerName,
      phone: query.data.phone ?? '',
      email: query.data.email ?? '',
      dueDate: query.data.dueDate ?? '',
      notes: query.data.notes ?? '',
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!form || !id) return;
    setSaving(true);
    setError(null);
    try {
      await updateDebtor(id, { ...form, amountOwed: query.data!.amountOwed });
      haptics.success();
      invalidate();
      setEditing(false);
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not update this customer.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePay() {
    if (!id) return;
    const amount = Number(payingAmount);
    if (!amount || amount <= 0) return;
    setPaying(true);
    try {
      await recordPayment(id, amount, payingNote);
      haptics.success();
      invalidate();
      setShowPayForm(false);
      setPayingAmount('');
      setPayingNote('');
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not record this payment.');
    } finally {
      setPaying(false);
    }
  }

  function handleDelete() {
    if (!id || !query.data) return;
    confirmAlert(`Delete "${query.data.customerName}"?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDebtor(id);
            haptics.success();
            router.back();
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not delete this customer.');
          }
        },
      },
    ]);
  }

  if (query.isLoading || !query.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        {query.isError ? <ErrorState onRetry={() => query.refetch()} /> : <ActivityIndicator />}
      </SafeAreaView>
    );
  }

  const debtor = query.data;

  // Gold/Silver tier is ranked against the org's own other customers'
  // amount owed (not a hardcoded currency figure, which wouldn't mean the
  // same thing across currencies) — the same basis the list screen's
  // "high value" segment uses, so the two stay consistent.
  const amounts = (overviewQuery.data?.debtors ?? []).map((d) => d.amountOwed).filter((a) => a > 0);
  let tier: { label: string; icon: string; className: string } = { label: 'Bronze', icon: '🥉', className: 'text-muted dark:text-muted-dark bg-border-2 dark:bg-border-2-dark' };
  if (amounts.length >= 3) {
    const sorted = [...amounts].sort((a, b) => b - a);
    const gold = sorted[Math.max(0, Math.floor(sorted.length * 0.1) - 1)];
    const silver = sorted[Math.max(0, Math.floor(sorted.length * 0.4) - 1)];
    if (debtor.lifetimeValue >= gold) tier = { label: 'Gold', icon: '🥇', className: 'text-amber dark:text-amber-dark bg-amber-weak dark:bg-amber-weak-dark' };
    else if (debtor.lifetimeValue >= silver) tier = { label: 'Silver', icon: '🥈', className: 'text-text-2 dark:text-text-2-dark bg-surface-2 dark:bg-surface-2-dark' };
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => (editing ? setEditing(false) : router.back())} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">{editing ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">{editing ? 'Edit customer' : debtor.customerName}</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        {editing && form ? (
          <>
            <TextField label="Customer name" value={form.customerName} onChangeText={(v) => setForm({ ...form, customerName: v })} />
            <TextField label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
            <TextField label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
            <TextField label="Due date (YYYY-MM-DD)" value={form.dueDate} onChangeText={(v) => setForm({ ...form, dueDate: v })} />
            <TextField label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline />
            {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}
            <Button loading={saving} onPress={handleSave} className="mt-2">
              Save changes
            </Button>
          </>
        ) : (
          <>
            <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <View className="flex-row items-start justify-between">
                <View>
                  <Text className="text-[11px] text-muted dark:text-muted-dark">Amount owed</Text>
                  <Text className="text-[22px] font-bold text-text dark:text-text-dark">{formatMoney(debtor.amountOwed, currency)}</Text>
                </View>
                <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${tier.className}`}>
                  <Text className="text-[11px]">{tier.icon}</Text>
                  <Text className={`text-[10.5px] font-bold ${tier.className}`}>{tier.label}</Text>
                </View>
              </View>
              <Text className="mt-1.5 text-[11.5px] text-muted dark:text-muted-dark">
                Lifetime value: {formatMoney(debtor.lifetimeValue, currency)}
              </Text>
              {debtor.phone && <Text className="mt-2 text-[12.5px] text-text-2 dark:text-text-2-dark">{debtor.phone}</Text>}
              {debtor.email && <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{debtor.email}</Text>}
              {debtor.dueDate && <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">Due {debtor.dueDate}</Text>}
              {debtor.notes && <Text className="mt-1 text-[12.5px] text-text-2 dark:text-text-2-dark">{debtor.notes}</Text>}
            </View>

            {debtor.amountOwed > 0 &&
              (showPayForm ? (
                <View className="gap-2.5 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
                  <TextField label="Payment amount" value={payingAmount} onChangeText={setPayingAmount} keyboardType="numeric" autoFocus />
                  <TextField label="Note (optional)" value={payingNote} onChangeText={setPayingNote} />
                  <View className="flex-row gap-2">
                    <Button variant="secondary" onPress={() => setShowPayForm(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button loading={paying} onPress={handlePay} className="flex-1">
                      Record
                    </Button>
                  </View>
                </View>
              ) : (
                <Button onPress={() => setShowPayForm(true)}>Record payment</Button>
              ))}

            <View className="flex-row gap-2.5">
              <Button variant="secondary" onPress={startEdit} className="flex-1">
                Edit
              </Button>
              {canDelete && (
                <Button variant="secondary" onPress={handleDelete} className="flex-1">
                  Delete
                </Button>
              )}
            </View>

            <Text className="mt-2 text-[13px] font-bold text-text dark:text-text-dark">Payment history</Text>
            {debtor.payments.length === 0 ? (
              <Text className="text-[12.5px] text-muted dark:text-muted-dark">No payments recorded yet.</Text>
            ) : (
              debtor.payments.map((p) => (
                <View key={p.id} className="flex-row items-center justify-between rounded-[10px] border border-border bg-surface px-3.5 py-2.5 dark:border-border-dark dark:bg-surface-dark">
                  <View>
                    <Text className="text-[12.5px] font-semibold text-text dark:text-text-dark">{new Date(p.paidAt).toLocaleDateString()}</Text>
                    {p.note && <Text className="text-[11px] text-muted dark:text-muted-dark">{p.note}</Text>}
                  </View>
                  <Text className="text-[12.5px] font-bold text-green dark:text-green-dark">{formatMoney(p.amount, currency)}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
