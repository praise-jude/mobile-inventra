import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { deleteSupplier, updateSupplier, type SupplierInput } from '@/lib/actions/suppliers';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useSupplierDetail } from '@/lib/hooks/use-suppliers';
import { isManagerRole } from '@/lib/roles';

// Mirrors Inventra/app/(app)/inventory/suppliers/[id]/page.tsx (there's no
// separate web route — this merges what web shows on the suppliers list
// row-expand plus the modal edit form into one screen for mobile).
export default function SupplierDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const profileQuery = useMyProfile();
  const currency = useOrgCurrency();
  const query = useSupplierDetail(id ?? null);
  const canManage = isManagerRole(profileQuery.data?.role ?? '');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SupplierInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['supplier-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['suppliers-detailed'] });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  }

  function startEdit() {
    if (!query.data) return;
    setForm({
      name: query.data.name,
      company: query.data.company ?? '',
      contactPerson: query.data.contactPerson ?? '',
      email: query.data.email ?? '',
      phone: query.data.phone ?? '',
      address: query.data.address ?? '',
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!form || !id) return;
    setSaving(true);
    setError(null);
    try {
      await updateSupplier(id, form);
      haptics.success();
      invalidate();
      setEditing(false);
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not update this supplier.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!id || !query.data) return;
    confirmAlert(`Delete "${query.data.name}"?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSupplier(id);
            haptics.success();
            router.back();
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not delete this supplier.');
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

  const supplier = query.data;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => (editing ? setEditing(false) : router.back())} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">{editing ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">{editing ? 'Edit supplier' : supplier.name}</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        {editing && form ? (
          <>
            <TextField label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <TextField label="Company" value={form.company} onChangeText={(v) => setForm({ ...form, company: v })} />
            <TextField label="Contact person" value={form.contactPerson} onChangeText={(v) => setForm({ ...form, contactPerson: v })} />
            <TextField label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
            <TextField label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
            <TextField label="Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} multiline />
            {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}
            <Button loading={saving} onPress={handleSave} className="mt-2">
              Save changes
            </Button>
          </>
        ) : (
          <>
            <View className="gap-2 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              {supplier.company && <Text className="text-[13px] text-text dark:text-text-dark">{supplier.company}</Text>}
              {supplier.contactPerson && <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">Contact: {supplier.contactPerson}</Text>}
              {supplier.email && <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{supplier.email}</Text>}
              {supplier.phone && <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{supplier.phone}</Text>}
              {supplier.address && <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{supplier.address}</Text>}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                <Text className="text-[11px] text-muted dark:text-muted-dark">Products</Text>
                <Text className="text-[17px] font-bold text-text dark:text-text-dark">{supplier.productCount}</Text>
              </View>
              <View className="flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                <Text className="text-[11px] text-muted dark:text-muted-dark">Total purchases</Text>
                <Text className="text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(supplier.totalPurchases, currency)}</Text>
              </View>
            </View>

            {canManage && (
              <View className="flex-row gap-2.5">
                <Button variant="secondary" onPress={startEdit} className="flex-1">
                  Edit
                </Button>
                <Button variant="secondary" onPress={handleDelete} className="flex-1">
                  Delete
                </Button>
              </View>
            )}

            <Text className="mt-2 text-[13px] font-bold text-text dark:text-text-dark">Recent purchases</Text>
            {supplier.purchases.length === 0 ? (
              <Text className="text-[12.5px] text-muted dark:text-muted-dark">No purchases recorded yet.</Text>
            ) : (
              supplier.purchases.map((p) => (
                <View key={p.id} className="flex-row items-center justify-between rounded-[10px] border border-border bg-surface px-3.5 py-2.5 dark:border-border-dark dark:bg-surface-dark">
                  <View>
                    <Text className="text-[12.5px] font-semibold text-text dark:text-text-dark">{p.productName}</Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark">{new Date(p.createdAt).toLocaleDateString()} · {p.qty} units</Text>
                  </View>
                  <Text className="text-[12.5px] font-bold text-text dark:text-text-dark">{formatMoney(p.amount, currency)}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
