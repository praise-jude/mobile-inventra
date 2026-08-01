import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { createWarehouse, type WarehouseInput } from '@/lib/actions/warehouses';
import { haptics } from '@/lib/haptics';
import { useActiveTeamMembers } from '@/lib/hooks/use-team';

export default function NewWarehouseScreen() {
  const queryClient = useQueryClient();
  const teamQuery = useActiveTeamMembers();
  const [form, setForm] = useState<WarehouseInput>({ name: '', address: '', country: '', state: '', phone: '', managerProfileId: undefined, capacity: undefined });
  const [capacityText, setCapacityText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const managerOptions = useMemo(
    () => (teamQuery.data ?? []).map((m) => ({ label: `${m.name} (${m.role})`, value: m.id })),
    [teamQuery.data],
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await createWarehouse({ ...form, capacity: capacityText ? Number(capacityText) : undefined });
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['warehouses-overview'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      router.back();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not create this branch.');
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
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">New branch</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <TextField label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Downtown Branch" autoFocus />
        <TextField label="Address (optional)" value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} multiline />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <TextField label="Country (optional)" value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} />
          </View>
          <View className="flex-1">
            <TextField label="State (optional)" value={form.state} onChangeText={(v) => setForm((f) => ({ ...f, state: v }))} />
          </View>
        </View>
        <TextField label="Phone (optional)" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
        <TextField label="Capacity in units (optional)" value={capacityText} onChangeText={setCapacityText} keyboardType="numeric" />
        <SelectField
          label="Branch manager (optional)"
          value={form.managerProfileId ?? ''}
          placeholder="No manager assigned"
          options={managerOptions}
          onChange={(v) => setForm((f) => ({ ...f, managerProfileId: v }))}
          searchable
        />

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleSave} className="mt-2">
          Save branch
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
