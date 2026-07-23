import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
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
import { supabase } from '@/lib/supabase';
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
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const referredQuery = useQuery({
    queryKey: ['referred-orgs', org.id],
    queryFn: async () => {
      const { data, error: fetchError } = await supabase
        .from('organizations')
        .select('id, name, created_at')
        .eq('referred_by_org_id', org.id)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      return data ?? [];
    },
  });

  async function copyReferral(text: string, which: 'code' | 'link') {
    await Clipboard.setStringAsync(text);
    haptics.success();
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

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

        <View className="mt-2 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Text className="mb-1 text-[14px] font-bold text-text dark:text-text-dark">Referral code</Text>
          <Text className="mb-3.5 text-[12px] text-muted dark:text-muted-dark">
            Share your code or link — businesses that sign up with it are linked to your organization here.
          </Text>

          <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Your code</Text>
          <View className="mb-3.5 flex-row items-center gap-2">
            <View className="flex-1 rounded-[9px] border border-border bg-bg px-[13px] py-[11px] dark:border-border-dark dark:bg-bg-dark">
              <Text className="font-mono text-[14px] tracking-wider text-text dark:text-text-dark">{org.referral_code}</Text>
            </View>
            <Pressable
              onPress={() => copyReferral(org.referral_code, 'code')}
              className="rounded-[9px] border border-border px-3.5 py-[11px] dark:border-border-dark"
            >
              <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{copied === 'code' ? 'Copied ✓' : 'Copy'}</Text>
            </Pressable>
          </View>

          {process.env.EXPO_PUBLIC_API_URL && (
            <>
              <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Shareable link</Text>
              <View className="mb-3.5 flex-row items-center gap-2">
                <View className="flex-1 rounded-[9px] border border-border bg-bg px-[13px] py-[11px] dark:border-border-dark dark:bg-bg-dark">
                  <Text numberOfLines={1} className="text-[12px] text-text-2 dark:text-text-2-dark">
                    {process.env.EXPO_PUBLIC_API_URL}/signup?ref={org.referral_code}
                  </Text>
                </View>
                <Pressable
                  onPress={() => copyReferral(`${process.env.EXPO_PUBLIC_API_URL}/signup?ref=${org.referral_code}`, 'link')}
                  className="rounded-[9px] border border-border px-3.5 py-[11px] dark:border-border-dark"
                >
                  <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{copied === 'link' ? 'Copied ✓' : 'Copy'}</Text>
                </Pressable>
              </View>
            </>
          )}

          <Text className="mb-2 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">
            Businesses referred by you{referredQuery.data && referredQuery.data.length > 0 ? ` (${referredQuery.data.length})` : ''}
          </Text>
          {!referredQuery.data || referredQuery.data.length === 0 ? (
            <Text className="text-[12.5px] text-muted dark:text-muted-dark">No signups with your code yet.</Text>
          ) : (
            <View className="gap-1.5">
              {referredQuery.data.map((r) => (
                <View key={r.id} className="flex-row items-center justify-between">
                  <Text className="text-[13px] text-text dark:text-text-dark">{r.name}</Text>
                  <Text className="text-[12px] text-muted dark:text-muted-dark">{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
