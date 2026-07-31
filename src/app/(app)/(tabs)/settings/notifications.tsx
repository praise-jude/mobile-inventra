import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { toggleNotification } from '@/lib/actions/settings';
import { haptics } from '@/lib/haptics';
import { useOrgSettings } from '@/lib/hooks/use-settings';
import type { NotificationSettings } from '@/types/database';

const ROWS: { key: keyof Omit<NotificationSettings, 'org_id'>; label: string; description: string }[] = [
  { key: 'low_stock', label: 'Low stock alerts', description: 'When a product falls to or below its reorder level' },
  { key: 'out_of_stock', label: 'Out of stock alerts', description: 'When a product runs out entirely' },
  { key: 'expiring_products', label: 'Expiring products', description: 'When stock is within 7 days of its expiry date' },
  { key: 'new_purchase_orders', label: 'New purchase orders', description: 'When a new purchase order is created' },
  { key: 'weekly_digest', label: 'Weekly digest', description: 'A weekly summary of sales and inventory activity' },
];

// Mirrors Inventra/components/settings/NotificationsClient.tsx.
export default function NotificationsSettingsScreen() {
  const settingsQuery = useOrgSettings();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(key: keyof Omit<NotificationSettings, 'org_id'>, value: boolean) {
    haptics.select();
    setPending(key);
    setError(null);
    try {
      await toggleNotification(key, value);
      settingsQuery.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this setting.');
    } finally {
      setPending(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Notifications</Text>
        <View className="w-14" />
      </View>

      {settingsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : settingsQuery.isError || !settingsQuery.data ? (
        <ErrorState onRetry={() => settingsQuery.refetch()} />
      ) : (
        <ScrollView contentContainerClassName="gap-2.5 p-5">
          {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}
          {ROWS.map((row) => (
            <View
              key={row.key}
              className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
            >
              <View className="flex-1">
                <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{row.label}</Text>
                <Text className="mt-0.5 text-[11.5px] leading-snug text-muted dark:text-muted-dark">{row.description}</Text>
              </View>
              <Switch
                value={settingsQuery.data.notifications[row.key]}
                onValueChange={(v) => handleToggle(row.key, v)}
                disabled={pending === row.key}
                trackColor={{ false: '#e5e7eb', true: '#2563eb' }}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
