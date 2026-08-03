import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { useEntitlements } from '@/lib/hooks/use-entitlements';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useWarehousesOverview } from '@/lib/hooks/use-warehouses';
import { isAdminRole } from '@/lib/roles';
import { useUpgradeModal } from '@/lib/upgrade-modal-context';

// Mirrors Inventra/components/inventory/WarehousesClient.tsx — table stays
// named `warehouses` in the DB, UI label is "Branches" per
// 20260708210200_branches_extend_schema.sql.
export default function WarehousesScreen() {
  const profileQuery = useMyProfile();
  const currency = useOrgCurrency();
  const query = useWarehousesOverview();
  const canManage = isAdminRole(profileQuery.data?.role ?? '');
  const entitlementsQuery = useEntitlements();
  const isPremium = entitlementsQuery.data?.tier === 'premium';
  const { openUpgradeModal } = useUpgradeModal();

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Branches</Text>
        <View className="w-12" />
      </View>

      {canManage && (
        <View className="p-4 pb-0">
          <Button onPress={() => (isPremium ? router.push('/inventory/warehouses/new') : openUpgradeModal())} className="self-start px-4">
            + New branch{!isPremium ? ' (PRO)' : ''}
          </Button>
        </View>
      )}

      {query.isLoading ? (
        <View className="gap-2.5 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState icon="🏬" title="No branches" description="Add a branch to organize stock by location." />
      ) : (
        <View className="gap-2.5 p-4">
          {query.data!.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => router.push(`/inventory/warehouses/${w.id}/edit`)}
              className={`rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark ${w.status === 'inactive' ? 'opacity-60' : ''}`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{w.name}</Text>
                {w.status === 'inactive' && (
                  <View className="rounded-full bg-border-2 px-2 py-0.5 dark:bg-border-2-dark">
                    <Text className="text-[10px] font-bold text-text-2 dark:text-text-2-dark">ARCHIVED</Text>
                  </View>
                )}
              </View>
              {w.managerName && <Text className="text-[12px] text-muted dark:text-muted-dark">Manager: {w.managerName}</Text>}
              <View className="mt-2 flex-row gap-4">
                <Text className="text-[11.5px] text-text-2 dark:text-text-2-dark">{w.skuCount} SKUs</Text>
                <Text className="text-[11.5px] text-text-2 dark:text-text-2-dark">{formatMoney(w.stockValue, currency)}</Text>
                {w.capacity != null && <Text className="text-[11.5px] text-text-2 dark:text-text-2-dark">{w.utilizationPct}% full</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
