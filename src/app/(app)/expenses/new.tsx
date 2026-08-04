import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { createExpense } from '@/lib/actions/expenses';
import { haptics } from '@/lib/haptics';
import { CATEGORY_LABEL } from '@/lib/hooks/use-expenses';
import { useWarehousesOverview } from '@/lib/hooks/use-warehouses';
import type { ExpenseCategory } from '@/types/database';

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => ({ label: CATEGORY_LABEL[c], value: c }));

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewExpenseScreen() {
  const queryClient = useQueryClient();
  const warehousesQuery = useWarehousesOverview();
  const [category, setCategory] = useState<ExpenseCategory>('miscellaneous');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [incurredAt, setIncurredAt] = useState(today());
  const [warehouseId, setWarehouseId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warehouseOptions = (warehousesQuery.data ?? []).map((w) => ({ label: w.name, value: w.id }));

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await createExpense({ category, description, amount: Number(amount) || 0, incurredAt, warehouseId: warehouseId || undefined });
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['expenses-totals'] });
      queryClient.invalidateQueries({ queryKey: ['recent-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-category-breakdown'] });
      router.back();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not create this expense.');
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
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">New expense</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <SelectField label="Category" value={category} options={CATEGORY_OPTIONS} onChange={(v) => setCategory(v as ExpenseCategory)} />
        <TextField label="Description (optional)" value={description} onChangeText={setDescription} />
        <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" autoFocus />
        <TextField label="Date (YYYY-MM-DD)" value={incurredAt} onChangeText={setIncurredAt} />
        <SelectField
          label="Branch (optional)"
          placeholder="Company-wide"
          value={warehouseId}
          options={warehouseOptions}
          onChange={setWarehouseId}
        />

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleSave} className="mt-2">
          Save expense
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
