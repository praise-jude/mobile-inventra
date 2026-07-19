import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { updatePrintSettings } from '@/lib/actions/settings';
import { haptics } from '@/lib/haptics';
import { useOrgSettings } from '@/lib/hooks/use-settings';
import type { PaperSize, PrintSettings } from '@/types/database';

const PAPER_SIZE_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: '58mm', label: '58mm (small thermal)' },
  { value: '80mm', label: '80mm (standard thermal)' },
  { value: 'a4', label: 'A4 (regular printer)' },
];

// Mirrors Inventra/components/settings/PrintingSettingsForm.tsx — configures
// the same print_settings row (app/(app)/sales/[id].tsx's receipt sharing
// isn't affected by paper_size directly since expo-print generates a
// standard PDF, but auto_print/receipt_footer are shared with web either way).
export default function PrintingSettingsScreen() {
  const settingsQuery = useOrgSettings();

  if (settingsQuery.isLoading || !settingsQuery.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  // Only mounts once print settings are loaded, so initial state can be
  // derived straight from props via useState's lazy initializer.
  return <PrintingForm printing={settingsQuery.data.printing} onInvalidate={settingsQuery.invalidate} />;
}

function PrintingForm({ printing, onInvalidate }: { printing: PrintSettings; onInvalidate: () => void }) {
  const [form, setForm] = useState({
    paperSize: printing.paper_size,
    autoPrint: printing.auto_print,
    receiptFooter: printing.receipt_footer ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updatePrintSettings(form);
      haptics.success();
      onInvalidate();
      router.back();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not save these settings.');
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
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Receipts & Printing</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <SelectField
          label="Paper size"
          value={form.paperSize}
          options={PAPER_SIZE_OPTIONS}
          onChange={(v) => setForm({ ...form, paperSize: v as PaperSize })}
        />

        <View className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <View className="flex-1 pr-3">
            <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">Auto-print receipts</Text>
            <Text className="mt-0.5 text-[11.5px] leading-snug text-muted dark:text-muted-dark">
              Automatically open the print dialog after each sale (web only)
            </Text>
          </View>
          <Switch
            value={form.autoPrint}
            onValueChange={(v) => setForm({ ...form, autoPrint: v })}
            trackColor={{ false: '#e5e7eb', true: '#2563eb' }}
          />
        </View>

        <TextField
          label="Receipt footer (optional)"
          placeholder="e.g. Thank you for shopping with us!"
          value={form.receiptFooter}
          onChangeText={(v) => setForm({ ...form, receiptFooter: v })}
          multiline
        />

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleSave} className="mt-2">
          Save changes
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
