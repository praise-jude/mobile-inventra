import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { timeAgo } from '@/lib/format';
import { useStockMovements } from '@/lib/hooks/use-inventory';
import { MOVEMENT_META } from '@/lib/movement-meta';

// Mirrors Inventra/components/inventory/MovementsTable.tsx — the full
// stock_movements ledger, every type.
export default function MovementsScreen() {
  const query = useStockMovements();
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Stock movements</Text>
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 p-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-5"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          onEndReached={() => {
            if (query.hasNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<EmptyState icon="🗃️" title="No movements yet" description="Stock changes will show up here." />}
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          renderItem={({ item }) => {
            const meta = MOVEMENT_META[item.type] ?? MOVEMENT_META.adjustment;
            return (
              <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                <View className={`h-9 w-9 items-center justify-center rounded-[9px] ${meta.bgClass}`}>
                  <Text className="text-[16px]">{meta.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{item.product_name}</Text>
                  <Text className="text-[11.5px] text-muted dark:text-muted-dark">
                    {meta.label} · {item.actor_name ?? 'System'} · {timeAgo(item.created_at)}
                  </Text>
                </View>
                <Text
                  className={`font-mono text-[13px] font-bold ${item.qty_delta >= 0 ? 'text-green dark:text-green-dark' : 'text-red dark:text-red-dark'}`}
                >
                  {item.qty_delta >= 0 ? '+' : ''}
                  {item.qty_delta}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
