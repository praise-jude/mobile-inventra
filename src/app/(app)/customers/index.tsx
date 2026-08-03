import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { PremiumLockedState } from '@/components/premium-locked-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { PlaceholderTextColor } from '@/constants/theme';
import { FLATLIST_PERF_PROPS } from '@/lib/flatlist-perf';
import { formatMoney } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useDebtorsList, useDebtorsTotals, type CustomerSegment, type DebtorRow } from '@/lib/hooks/use-debtors';
import { useEntitlements } from '@/lib/hooks/use-entitlements';
import { useOrgCurrency } from '@/lib/hooks/use-org';

const STATUS_STYLE: Record<DebtorRow['status'], { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'text-sky dark:text-sky-dark bg-sky-weak dark:bg-sky-weak-dark' },
  partially_paid: { label: 'Partial', className: 'text-amber dark:text-amber-dark bg-amber-weak dark:bg-amber-weak-dark' },
  paid: { label: 'Paid', className: 'text-green dark:text-green-dark bg-green-weak dark:bg-green-weak-dark' },
  overdue: { label: 'Overdue', className: 'text-red dark:text-red-dark bg-red-weak dark:bg-red-weak-dark' },
  cancelled: { label: 'Cancelled', className: 'text-muted dark:text-muted-dark bg-border-2 dark:bg-border-2-dark' },
};

const SEGMENT_FILTERS: { key: CustomerSegment | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'high_value', label: '⭐ High value' },
  { key: 'overdue', label: '⚠️ Overdue' },
  { key: 'new', label: '🆕 New' },
  { key: 'paid_up', label: '✅ Paid up' },
];

const CustomerRowItem = memo(function CustomerRowItem({ item, currency, onPress }: { item: DebtorRow; currency: string; onPress: (id: string) => void }) {
  return (
    <Pressable
      onPress={() => onPress(item.id)}
      className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
    >
      <View className="flex-1">
        <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{item.customerName}</Text>
        <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
          <View className={`self-start rounded-full px-2 py-0.5 ${STATUS_STYLE[item.status].className}`}>
            <Text className={`text-[10.5px] font-bold ${STATUS_STYLE[item.status].className}`}>{STATUS_STYLE[item.status].label}</Text>
          </View>
        </View>
      </View>
      <Text className="text-[13.5px] font-bold text-text dark:text-text-dark">{formatMoney(item.amountOwed, currency)}</Text>
    </Pressable>
  );
});

// Mirrors Inventra/components/debtors/DebtorsClient.tsx — Sidebar.tsx labels
// this nav item "Customers" though the table/module is "Debtors" (credit
// tracking), same "DB name stays, UI label changes" pattern as Warehouses/
// Branches. List is server-paginated (useDebtorsList) same as Inventory's
// useProducts, not a client-side filter over one unbounded fetch anymore.
export default function CustomersScreen() {
  const currency = useOrgCurrency();
  const entitlementsQuery = useEntitlements();
  const isPremium = entitlementsQuery.data?.tier === 'premium';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | ''>('');

  const totalsQuery = useDebtorsTotals();
  const listQuery = useDebtorsList(
    { search: debouncedSearch, segment: segmentFilter },
    totalsQuery.data?.highValueThreshold ?? null,
  );
  const debtors = useMemo(() => listQuery.data?.pages.flatMap((p) => p.rows) ?? [], [listQuery.data]);
  const handleOpenCustomer = useCallback((id: string) => router.push(`/customers/${id}`), []);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Customers</Text>
        <View className="w-12" />
      </View>

      {entitlementsQuery.data && !isPremium ? (
        <PremiumLockedState feature="Customer management" />
      ) : totalsQuery.isLoading || listQuery.isLoading ? (
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
              <Text className="text-[11px] text-muted dark:text-muted-dark">Outstanding</Text>
              <Text className="text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(totalsQuery.data!.totalOutstanding, currency)}</Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Overdue</Text>
              <Text className="text-[17px] font-bold text-red dark:text-red-dark">{formatMoney(totalsQuery.data!.overdueAmount, currency)}</Text>
            </View>
          </View>

          <View className="gap-2.5 p-4">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search customers…"
              placeholderTextColor={PlaceholderTextColor}
              className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
            <Button onPress={() => router.push('/customers/new')} className="self-start px-4">
              + New customer
            </Button>
          </View>

          <View className="flex-row flex-wrap gap-2 px-4 pb-2">
            {SEGMENT_FILTERS.map((f) => {
              const active = segmentFilter === f.key;
              return (
                <Pressable
                  key={f.key || 'all'}
                  onPress={() => setSegmentFilter(f.key)}
                  className={`rounded-full border px-3 py-1.5 ${active ? 'border-accent bg-accent-weak dark:border-accent-dark dark:bg-accent-weak-dark' : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'}`}
                >
                  <Text className={`text-[12px] font-semibold ${active ? 'text-accent-text dark:text-accent-text-dark' : 'text-text-2 dark:text-text-2-dark'}`}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {debtors.length === 0 ? (
            <EmptyState icon="💵" title="No customers" description="Track a customer's credit balance to see them here." />
          ) : (
            <FlatList
              data={debtors}
              keyExtractor={(d) => d.id}
              {...FLATLIST_PERF_PROPS}
              contentContainerClassName="gap-2 px-4 pb-6"
              refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={() => listQuery.refetch()} />}
              onEndReached={() => {
                if (listQuery.hasNextPage) void listQuery.fetchNextPage();
              }}
              onEndReachedThreshold={0.4}
              renderItem={({ item }) => <CustomerRowItem item={item} currency={currency} onPress={handleOpenCustomer} />}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
