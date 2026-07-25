import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { createSupplier, type SupplierInput } from '@/lib/actions/suppliers';
import { haptics } from '@/lib/haptics';

export default function NewSupplierScreen() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SupplierInput>({ name: '', company: '', contactPerson: '', email: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await createSupplier(form);
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['suppliers-detailed'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      router.back();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not create this supplier.');
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
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">New supplier</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <TextField label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Coastal Distributors" autoFocus />
        <TextField label="Company (optional)" value={form.company} onChangeText={(v) => setForm((f) => ({ ...f, company: v }))} />
        <TextField label="Contact person (optional)" value={form.contactPerson} onChangeText={(v) => setForm((f) => ({ ...f, contactPerson: v }))} />
        <TextField label="Email (optional)" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Phone (optional)" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
        <TextField label="Address (optional)" value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} multiline />

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleSave} className="mt-2">
          Save supplier
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
