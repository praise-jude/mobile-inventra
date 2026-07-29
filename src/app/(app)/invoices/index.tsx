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
import { useInvoicesList, useInvoicesTotals, type InvoiceRow } from '@/lib/hooks/use-invoices';
import { useOrgCurrency } from '@/lib/hooks/use-org-currency';

const STATUS_STYLE: Record<InvoiceRow['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'text-muted dark:text-muted-dark bg-border-2 dark:bg-border-2-dark' },
  sent: { label: 'Sent', className: 'text-sky dark:text-sky-dark bg-sky-weak dark:bg-sky-weak-dark' },
  paid: { label: 'Paid', className: 'text-green dark:text-green-dark bg-green-weak dark:bg-green-weak-dark' },
  overdue: { label: 'Overdue', className: 'text-red dark:text-red-dark bg-red-weak dark:bg-red-weak-dark' },
  void: { label: 'Void', className: 'text-muted dark:text-muted-dark bg-border-2 dark:bg-border-2-dark' },
};

// Mirrors Inventra/components/invoices/InvoicesClient.tsx. List is
// server-paginated (useInvoicesList) same as Inventory/Customers, not a
// client-side filter over one unbounded fetch anymore.
export default function InvoicesScreen() {
  const currency = useOrgCurrency();
  const totalsQuery = useInvoicesTotals();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const listQuery = useInvoicesList({ search: debouncedSearch });
  const invoices = useMemo(() => listQuery.data?.pages.flatMap((p) => p.rows) ?? [], [listQuery.data]);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Invoices</Text>
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
              <Text className="text-[11px] text-muted dark:text-muted-dark">Outstanding</Text>
              <Text className="text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(totalsQuery.data!.totalOutstanding, currency)}</Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Overdue</Text>
              <Text className="text-[17px] font-bold text-red dark:text-red-dark">{totalsQuery.data!.overdueCount}</Text>
            </View>
          </View>

          <View className="gap-2.5 p-4">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by customer or invoice number…"
              placeholderTextColor="#aab2c4"
              className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
            <Button onPress={() => router.push('/invoices/new')} className="self-start px-4">
              + New invoice
            </Button>
          </View>

          {invoices.length === 0 ? (
            <EmptyState icon="📄" title="No invoices" description="Create an invoice to bill a customer for goods or services." />
          ) : (
            <FlatList
              data={invoices}
              keyExtractor={(i) => i.id}
              {...FLATLIST_PERF_PROPS}
              contentContainerClassName="gap-2 px-4 pb-6"
              refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={() => listQuery.refetch()} />}
              onEndReached={() => {
                if (listQuery.hasNextPage) void listQuery.fetchNextPage();
              }}
              onEndReachedThreshold={0.4}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/invoices/${item.id}`)}
                  className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
                >
                  <View className="flex-1">
                    <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{item.customerName}</Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark">{item.invoiceNumber}</Text>
                    <View className={`mt-1.5 self-start rounded-full px-2 py-0.5 ${STATUS_STYLE[item.status].className}`}>
                      <Text className={`text-[10.5px] font-bold ${STATUS_STYLE[item.status].className}`}>{STATUS_STYLE[item.status].label}</Text>
                    </View>
                  </View>
                  <Text className="text-[13.5px] font-bold text-text dark:text-text-dark">{formatMoney(item.total, currency)}</Text>
                </Pressable>
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
