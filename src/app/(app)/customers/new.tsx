import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { createDebtor, type DebtorInput } from '@/lib/actions/debtors';
import { haptics } from '@/lib/haptics';

export default function NewCustomerScreen() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Omit<DebtorInput, 'amountOwed'> & { amountOwed: string }>({
    customerName: '',
    phone: '',
    email: '',
    amountOwed: '0',
    dueDate: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await createDebtor({ ...form, amountOwed: Number(form.amountOwed) || 0 });
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['debtors-overview'] });
      router.back();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not create this customer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Cancel</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">New customer</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <TextField label="Customer name" value={form.customerName} onChangeText={(v) => setForm((f) => ({ ...f, customerName: v }))} autoFocus />
        <TextField label="Phone (optional)" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
        <TextField label="Email (optional)" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Amount owed" value={form.amountOwed} onChangeText={(v) => setForm((f) => ({ ...f, amountOwed: v }))} keyboardType="numeric" />
        <TextField label="Due date (YYYY-MM-DD, optional)" value={form.dueDate} onChangeText={(v) => setForm((f) => ({ ...f, dueDate: v }))} />
        <TextField label="Notes (optional)" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleSave} className="mt-2">
          Save customer
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
