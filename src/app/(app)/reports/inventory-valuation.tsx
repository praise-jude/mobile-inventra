import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { formatMoney } from '@/lib/format';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useInventoryValuation } from '@/lib/hooks/use-reports';

// Mirrors Inventra/components/reports/InventoryValuationClient.tsx.
export default function InventoryValuationScreen() {
  const currency = useOrgCurrency();
  const query = useInventoryValuation();

  const totals = useMemo(() => {
    const rows = query.data ?? [];
    return {
      value: rows.reduce((sum, r) => sum + r.inventoryValue, 0),
      profit: rows.reduce((sum, r) => sum + r.expectedProfit, 0),
    };
  }, [query.data]);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Inventory Valuation</Text>
        <View className="w-10" />
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(item) => item.productId}
          contentContainerClassName="p-5"
          ListHeaderComponent={
            (query.data?.length ?? 0) > 0 ? (
              <View className="mb-4 flex-row gap-3">
                <View className="flex-1 rounded-[14px] border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                  <Text className="text-[11.5px] font-semibold text-text-2 dark:text-text-2-dark">Total value</Text>
                  <Text className="mt-1.5 font-mono text-[16px] font-bold text-text dark:text-text-dark">{formatMoney(totals.value, currency)}</Text>
                </View>
                <View className="flex-1 rounded-[14px] border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                  <Text className="text-[11.5px] font-semibold text-text-2 dark:text-text-2-dark">Expected profit</Text>
                  <Text className="mt-1.5 font-mono text-[16px] font-bold text-text dark:text-text-dark">{formatMoney(totals.profit, currency)}</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={<EmptyState icon="📦" title="No inventory yet" description="Add products to see their valuation here." />}
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <View className="flex-1 pr-2">
                <Text className="text-[13px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-[11px] text-muted dark:text-muted-dark">
                  {item.sku} · {item.qtyOnHand} on hand{item.warehouseName ? ` · ${item.warehouseName}` : ''}
                </Text>
              </View>
              <Text className="font-mono text-[13px] font-bold text-text dark:text-text-dark">{formatMoney(item.inventoryValue, currency)}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
