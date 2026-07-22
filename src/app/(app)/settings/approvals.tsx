import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/ui/text-field';
import { Button } from '@/components/ui/button';
import { updateApprovalSettings, type ApprovalSettingsInput } from '@/lib/actions/settings';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import type { ApprovalSettingsRow } from '@/types/database';

// Mirrors Inventra/components/settings/ApprovalSettingsForm.tsx — same three
// thresholds, same approval_settings row.
export default function ApprovalSettingsScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['approval-settings', session?.user.id],
    queryFn: async (): Promise<ApprovalSettingsRow> => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', session!.user.id)
        .single();
      if (profileError || !profile) throw new Error('Could not load your profile.');

      const { data, error } = await supabase.from('approval_settings').select('*').eq('org_id', profile.org_id).single();
      if (error || !data) throw new Error('Could not load approval settings.');
      return data;
    },
    enabled: !!session,
  });

  if (query.isLoading || !query.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <ApprovalForm
      settings={query.data}
      onInvalidate={() => queryClient.invalidateQueries({ queryKey: ['approval-settings'] })}
    />
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <Text className="flex-1 pr-3 text-[13.5px] font-semibold text-text dark:text-text-dark">{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#e5e7eb', true: '#2563eb' }} />
    </View>
  );
}

function ApprovalForm({ settings, onInvalidate }: { settings: ApprovalSettingsRow; onInvalidate: () => void }) {
  const [form, setForm] = useState<ApprovalSettingsInput>({
    discountApprovalEnabled: settings.discount_approval_enabled,
    discountThresholdPct: settings.discount_threshold_pct,
    voidApprovalEnabled: settings.void_approval_enabled,
    voidThresholdAmount: settings.void_threshold_amount,
    priceChangeApprovalEnabled: settings.price_change_approval_enabled,
    priceChangeThresholdPct: settings.price_change_threshold_pct,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateApprovalSettings(form);
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
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Approvals</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <Text className="text-[12px] text-muted dark:text-muted-dark">
          Require manager/admin sign-off before a discount, void, or price change above these thresholds takes effect.
        </Text>

        <ToggleRow
          label="Require approval for large discounts"
          value={form.discountApprovalEnabled}
          onValueChange={(v) => setForm((f) => ({ ...f, discountApprovalEnabled: v }))}
        />
        {form.discountApprovalEnabled && (
          <TextField
            label="Discount threshold (%)"
            keyboardType="numeric"
            value={String(form.discountThresholdPct)}
            onChangeText={(v) => setForm((f) => ({ ...f, discountThresholdPct: Number(v) || 0 }))}
          />
        )}

        <ToggleRow
          label="Require approval to void large sales"
          value={form.voidApprovalEnabled}
          onValueChange={(v) => setForm((f) => ({ ...f, voidApprovalEnabled: v }))}
        />
        {form.voidApprovalEnabled && (
          <TextField
            label="Void threshold (amount)"
            keyboardType="numeric"
            value={String(form.voidThresholdAmount)}
            onChangeText={(v) => setForm((f) => ({ ...f, voidThresholdAmount: Number(v) || 0 }))}
          />
        )}

        <ToggleRow
          label="Require approval for large price changes"
          value={form.priceChangeApprovalEnabled}
          onValueChange={(v) => setForm((f) => ({ ...f, priceChangeApprovalEnabled: v }))}
        />
        {form.priceChangeApprovalEnabled && (
          <TextField
            label="Price change threshold (%)"
            keyboardType="numeric"
            value={String(form.priceChangeThresholdPct)}
            onChangeText={(v) => setForm((f) => ({ ...f, priceChangeThresholdPct: Number(v) || 0 }))}
          />
        )}

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleSave} className="mt-2">
          Save changes
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
