import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { formatMoney, timeAgo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useSales } from '@/lib/hooks/use-sales';
import type { PaymentMethod } from '@/types/database';

const PAYMENT_FILTERS: { key: PaymentMethod | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'bank_transfer', label: 'Bank Transfer' },
  { key: 'mobile_money', label: 'Mobile Money' },
];

// Mirrors Inventra/components/sales/SalesClient.tsx — search + infinite
// scroll list, tap a row for the receipt/detail screen. "New Sale" is
// hidden for warehouse-role accounts, matching recordSale's own
// requireSalesRole gate.
export default function SalesScreen() {
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'all'>('all');
  const debouncedSearch = useDebouncedValue(search, 300);
  const currency = useOrgCurrency();
  const profileQuery = useMyProfile();
  const canRecordSale = profileQuery.data && profileQuery.data.role !== 'warehouse';

  const query = useSales({ search: debouncedSearch, paymentMethod: paymentFilter === 'all' ? undefined : paymentFilter });
  const sales = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="px-5 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Sales</Text>
          {canRecordSale && (
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push('/sales/new');
              }}
              className="h-9 w-9 items-center justify-center rounded-full bg-accent dark:bg-accent-dark"
            >
              <Text className="text-[20px] font-bold text-white">+</Text>
            </Pressable>
          )}
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by customer…"
          placeholderTextColor="#aab2c4"
          className="mt-3 h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />

        <View className="mt-3 flex-row flex-wrap gap-2">
          {PAYMENT_FILTERS.map((f) => {
            const active = paymentFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  haptics.select();
                  setPaymentFilter(f.key);
                }}
                className={`rounded-full border px-3 py-1.5 ${
                  active
                    ? 'border-accent bg-accent-weak dark:border-accent-dark dark:bg-accent-weak-dark'
                    : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
                }`}
              >
                <Text
                  className={`text-[12.5px] font-semibold ${
                    active ? 'text-accent-text dark:text-accent-text-dark' : 'text-text-2 dark:text-text-2-dark'
                  }`}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 px-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[62px] w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 pb-10"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          onEndReached={() => {
            if (query.hasNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              icon="🧾"
              title="No sales yet"
              description={canRecordSale ? 'Record your first sale to see it here.' : 'Sales will show up here once recorded.'}
            />
          }
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push(`/sales/${item.id}`);
              }}
              className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
            >
              <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                <Text className="text-[16px]">🧾</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
                  {item.customerName}
                </Text>
                <Text className="text-[11.5px] text-muted dark:text-muted-dark">
                  {item.warehouseName ? `${item.warehouseName} · ` : ''}
                  {timeAgo(item.createdAt)}
                </Text>
              </View>
              <Text className="font-mono text-[13.5px] font-bold text-text dark:text-text-dark">{formatMoney(item.total, currency)}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
