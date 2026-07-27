import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { PremiumLockedState } from '@/components/premium-locked-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { FLATLIST_PERF_PROPS } from '@/lib/flatlist-perf';
import { formatMoney } from '@/lib/format';
import { useDebtorsOverview, type DebtorRow } from '@/lib/hooks/use-debtors';
import { useEntitlements } from '@/lib/hooks/use-entitlements';
import { useOrgCurrency } from '@/lib/hooks/use-org-currency';

const STATUS_STYLE: Record<DebtorRow['status'], { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'text-sky dark:text-sky-dark bg-sky-weak dark:bg-sky-weak-dark' },
  partially_paid: { label: 'Partial', className: 'text-amber dark:text-amber-dark bg-amber-weak dark:bg-amber-weak-dark' },
  paid: { label: 'Paid', className: 'text-green dark:text-green-dark bg-green-weak dark:bg-green-weak-dark' },
  overdue: { label: 'Overdue', className: 'text-red dark:text-red-dark bg-red-weak dark:bg-red-weak-dark' },
  cancelled: { label: 'Cancelled', className: 'text-muted dark:text-muted-dark bg-border-2 dark:bg-border-2-dark' },
};

// Mirrors Inventra/components/debtors/DebtorsClient.tsx — Sidebar.tsx labels
// this nav item "Customers" though the table/module is "Debtors" (credit
// tracking), same "DB name stays, UI label changes" pattern as Warehouses/
// Branches.
export default function CustomersScreen() {
  const currency = useOrgCurrency();
  const query = useDebtorsOverview();
  const entitlementsQuery = useEntitlements();
  const isPremium = entitlementsQuery.data?.tier === 'premium';
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = query.data?.debtors ?? [];
    if (!q) return rows;
    return rows.filter((d) => d.customerName.toLowerCase().includes(q));
  }, [query.data, search]);

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
      ) : query.isLoading ? (
        <View className="gap-2.5 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2.5 p-4 pb-0">
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Outstanding</Text>
              <Text className="text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(query.data!.totalOutstanding, currency)}</Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Overdue</Text>
              <Text className="text-[17px] font-bold text-red dark:text-red-dark">{formatMoney(query.data!.overdueAmount, currency)}</Text>
            </View>
          </View>

          <View className="gap-2.5 p-4">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search customers…"
              placeholderTextColor="#aab2c4"
              className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
            <Button onPress={() => router.push('/customers/new')} className="self-start px-4">
              + New customer
            </Button>
          </View>

          {filtered.length === 0 ? (
            <EmptyState icon="💵" title="No customers" description="Track a customer's credit balance to see them here." />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(d) => d.id}
              {...FLATLIST_PERF_PROPS}
              contentContainerClassName="gap-2 px-4 pb-6"
              refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/customers/${item.id}`)}
                  className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
                >
                  <View className="flex-1">
                    <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{item.customerName}</Text>
                    <View className={`mt-1.5 self-start rounded-full px-2 py-0.5 ${STATUS_STYLE[item.status].className}`}>
                      <Text className={`text-[10.5px] font-bold ${STATUS_STYLE[item.status].className}`}>{STATUS_STYLE[item.status].label}</Text>
                    </View>
                  </View>
                  <Text className="text-[13.5px] font-bold text-text dark:text-text-dark">{formatMoney(item.amountOwed, currency)}</Text>
                </Pressable>
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
