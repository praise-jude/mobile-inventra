import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { FLATLIST_PERF_PROPS } from '@/lib/flatlist-perf';
import { formatMoney } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useSupplyRecordsList, useSupplyTotals, type SupplyRecordRow } from '@/lib/hooks/use-supply-records';

const STATUS_STYLE: Record<SupplyRecordRow['status'], { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'text-amber dark:text-amber-dark bg-amber-weak dark:bg-amber-weak-dark' },
  received: { label: 'Received', className: 'text-sky dark:text-sky-dark bg-sky-weak dark:bg-sky-weak-dark' },
  verified: { label: 'Verified', className: 'text-green dark:text-green-dark bg-green-weak dark:bg-green-weak-dark' },
  cancelled: { label: 'Cancelled', className: 'text-red dark:text-red-dark bg-red-weak dark:bg-red-weak-dark' },
};

// Mirrors Inventra/components/supply-records/SupplyRecordsClient.tsx —
// server-paginated list (useSupplyRecordsList), same pattern as
// Invoices/Debtors on mobile.
export default function SupplyRecordsScreen() {
  const currency = useOrgCurrency();
  const totalsQuery = useSupplyTotals();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const listQuery = useSupplyRecordsList({ search: debouncedSearch });
  const records = useMemo(() => listQuery.data?.pages.flatMap((p) => p.rows) ?? [], [listQuery.data]);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Supply Records</Text>
        <View className="w-12" />
      </View>

      {totalsQuery.isLoading || listQuery.isLoading ? (
        <View className="gap-2.5 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] w-full" />
          ))}
        </View>
      ) : totalsQuery.isError || listQuery.isError ? (
        <ErrorState onRetry={() => (totalsQuery.isError ? totalsQuery.refetch() : listQuery.refetch())} />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2.5 p-4 pb-0">
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Total supplies</Text>
              <Text className="text-[17px] font-bold text-text dark:text-text-dark">{totalsQuery.data!.totalSupplies}</Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Total amount</Text>
              <Text className="text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(totalsQuery.data!.totalAmount, currency)}</Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">This month</Text>
              <Text className="text-[17px] font-bold text-text dark:text-text-dark">{totalsQuery.data!.thisMonthSupplies}</Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Top supplier</Text>
              <Text className="text-[13.5px] font-bold text-text dark:text-text-dark" numberOfLines={1}>
                {totalsQuery.data!.topSupplier?.name ?? '—'}
              </Text>
            </View>
          </View>

          <View className="gap-2.5 p-4">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by supplier, invoice #, or reference…"
              placeholderTextColor="#aab2c4"
              className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
            <Button onPress={() => router.push('/supply-records/new')} className="self-start px-4">
              + New supply record
            </Button>
          </View>

          {records.length === 0 ? (
            <EmptyState icon="📦" title="No supply records" description="Record a delivery from a supplier to get started." />
          ) : (
            <FlatList
              data={records}
              keyExtractor={(r) => r.id}
              {...FLATLIST_PERF_PROPS}
              contentContainerClassName="gap-2 px-4 pb-6"
              refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={() => listQuery.refetch()} />}
              onEndReached={() => {
                if (listQuery.hasNextPage) void listQuery.fetchNextPage();
              }}
              onEndReachedThreshold={0.4}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/supply-records/${item.id}`)}
                  className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
                >
                  <View className="flex-1">
                    <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{item.supplierName}</Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark">{item.referenceNumber}</Text>
                    <View className={`mt-1.5 self-start rounded-full px-2 py-0.5 ${STATUS_STYLE[item.status].className}`}>
                      <Text className={`text-[10.5px] font-bold ${STATUS_STYLE[item.status].className}`}>{STATUS_STYLE[item.status].label}</Text>
                    </View>
                  </View>
                  <Text className="text-[13.5px] font-bold text-text dark:text-text-dark">{formatMoney(item.totalAmount, currency)}</Text>
                </Pressable>
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
