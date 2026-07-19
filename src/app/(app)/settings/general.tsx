import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { updateGeneralSettings } from '@/lib/actions/settings';
import { COUNTRIES, CURRENCY_CODES, IANA_TIMEZONES, statesForCountry, timezoneFor } from '@/lib/geo/countries';
import { haptics } from '@/lib/haptics';
import { useOrgSettings } from '@/lib/hooks/use-settings';
import type { Organization } from '@/types/database';

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
const CURRENCY_OPTIONS = CURRENCY_CODES.map((c) => ({ value: c, label: c }));
const TIMEZONE_OPTIONS = IANA_TIMEZONES.map((tz) => ({ value: tz, label: tz }));

// Mirrors Inventra/components/settings/GeneralSettingsForm.tsx.
export default function GeneralSettingsScreen() {
  const settingsQuery = useOrgSettings();

  if (settingsQuery.isLoading || !settingsQuery.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  // Only mounts once org data is loaded, so its initial state can be derived
  // straight from props via useState's lazy initializer — no effect needed
  // to sync query data into local state (see GeneralForm below).
  return <GeneralForm org={settingsQuery.data.org} onInvalidate={settingsQuery.invalidate} />;
}

function GeneralForm({ org, onInvalidate }: { org: Organization; onInvalidate: () => void }) {
  const [form, setForm] = useState({
    name: org.name,
    supportEmail: org.support_email ?? '',
    currency: org.currency,
    country: org.country ?? '',
    state: org.state ?? '',
    timezone: org.timezone,
    taxRate: String(org.tax_rate),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateGeneralSettings({
        name: form.name,
        supportEmail: form.supportEmail,
        currency: form.currency,
        country: form.country,
        state: form.state,
        timezone: form.timezone,
        taxRate: Number(form.taxRate) || 0,
      });
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

  const stateOptions = statesForCountry(form.country).map((s) => ({ value: s, label: s }));

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Cancel</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">General</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <TextField label="Business name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
        <TextField
          label="Support email (optional)"
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.supportEmail}
          onChangeText={(v) => setForm({ ...form, supportEmail: v })}
        />
        <SelectField
          label="Country"
          searchable
          placeholder="Select country…"
          value={form.country}
          options={COUNTRY_OPTIONS}
          onChange={(v) => setForm({ ...form, country: v, state: '', timezone: timezoneFor(v) })}
        />
        {stateOptions.length > 0 && (
          <SelectField
            label="State/Province"
            searchable
            placeholder="Select state…"
            value={form.state}
            options={stateOptions}
            onChange={(v) => setForm({ ...form, state: v, timezone: timezoneFor(form.country, v) })}
          />
        )}
        <SelectField label="Currency" searchable value={form.currency} options={CURRENCY_OPTIONS} onChange={(v) => setForm({ ...form, currency: v })} />
        <SelectField label="Timezone" searchable value={form.timezone} options={TIMEZONE_OPTIONS} onChange={(v) => setForm({ ...form, timezone: v })} />
        <TextField
          label="Tax rate (%)"
          keyboardType="decimal-pad"
          value={form.taxRate}
          onChangeText={(v) => setForm({ ...form, taxRate: v })}
        />

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleSave} className="mt-2">
          Save changes
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
