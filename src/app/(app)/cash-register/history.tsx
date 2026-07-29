import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { FLATLIST_PERF_PROPS } from '@/lib/flatlist-perf';
import { formatMoney } from '@/lib/format';
import { notifyAlert } from '@/lib/confirm';
import { useCashRegisterHistory, type CashRegisterRow } from '@/lib/hooks/use-cash-register';
import { useOrgCurrency } from '@/lib/hooks/use-org-currency';
import { useWarehouseOptions } from '@/lib/hooks/use-warehouse-options';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function historyHtml(rows: CashRegisterRow[], currency: string): string {
  const trs = rows
    .map(
      (r) =>
        `<tr><td>${r.businessDate}</td><td>${escapeHtml(r.warehouseName)}</td><td style="text-align:right">${formatMoney(r.openingBalance, currency)}</td><td style="text-align:right">${formatMoney(r.cashSales ?? 0, currency)}</td><td style="text-align:right">${formatMoney(r.expectedClosingBalance ?? 0, currency)}</td><td style="text-align:right">${formatMoney(r.actualCashCount ?? 0, currency)}</td><td style="text-align:right">${formatMoney(r.difference ?? 0, currency)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    td, th { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  </style></head><body>
    <h1>Cash Register History</h1>
    <table>
      <thead><tr><th>Date</th><th>Branch</th><th>Opening</th><th>Cash Sales</th><th>Expected</th><th>Actual</th><th>Difference</th></tr></thead>
      ${trs}
    </table>
  </body></html>`;
}

// Mirrors the History section of Inventra/components/cash-register/
// CashRegisterClient.tsx — own screen here (not a section) matching how
// audit-log is separate from other Manager-tier+ modules on mobile.
export default function CashRegisterHistoryScreen() {
  const currency = useOrgCurrency();
  const branchesQuery = useWarehouseOptions();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const branchId = selectedBranchId ?? branchesQuery.data?.[0]?.id ?? null;

  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [sharing, setSharing] = useState(false);

  const query = useCashRegisterHistory(branchId, from, to);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!q) return rows;
    return rows.filter((r) => r.businessDate.includes(q) || (r.closedByName ?? '').toLowerCase().includes(q));
  }, [query.data, search]);

  async function handleShare() {
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: historyHtml(filtered, currency) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Cash Register History' });
      }
    } catch {
      notifyAlert('Error', 'Could not generate the history PDF.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">History</Text>
        <View className="w-12" />
      </View>

      <View className="gap-2.5 p-4">
        {branchesQuery.data && branchesQuery.data.length > 1 && branchId && (
          <SelectField label="Branch" value={branchId} options={branchesQuery.data.map((b) => ({ label: b.name, value: b.id }))} onChange={setSelectedBranchId} />
        )}
        <View className="flex-row gap-2.5">
          <TextInput
            value={from}
            onChangeText={setFrom}
            placeholder="From (YYYY-MM-DD)"
            placeholderTextColor="#aab2c4"
            className="h-[42px] flex-1 rounded-[9px] border border-border bg-surface px-[13px] text-[13px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="To (YYYY-MM-DD)"
            placeholderTextColor="#aab2c4"
            className="h-[42px] flex-1 rounded-[9px] border border-border bg-surface px-[13px] text-[13px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search…"
          placeholderTextColor="#aab2c4"
          className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />
        <Button variant="secondary" loading={sharing} onPress={handleShare} disabled={filtered.length === 0}>
          Share as PDF
        </Button>
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🗓️" title="No history yet" description="Closed business days will show up here." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          {...FLATLIST_PERF_PROPS}
          contentContainerClassName="gap-2 px-4 pb-6"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          renderItem={({ item }) => (
            <View className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <View className="flex-row items-center justify-between">
                <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{item.businessDate}</Text>
                {item.difference !== null && (
                  <Text className={`text-[12px] font-bold ${item.difference === 0 ? 'text-green dark:text-green-dark' : 'text-red dark:text-red-dark'}`}>
                    {item.difference === 0 ? '✅ Balanced' : formatMoney(item.difference, currency)}
                  </Text>
                )}
              </View>
              <View className="mt-1.5 flex-row flex-wrap gap-x-4 gap-y-1">
                <Text className="text-[11px] text-muted dark:text-muted-dark">Opening {formatMoney(item.openingBalance, currency)}</Text>
                <Text className="text-[11px] text-muted dark:text-muted-dark">Cash sales {formatMoney(item.cashSales ?? 0, currency)}</Text>
                <Text className="text-[11px] text-muted dark:text-muted-dark">Closed by {item.closedByName ?? '—'}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
