import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { ReportsAccessGate } from '@/components/reports-access-gate';
import { PRESET_LABELS, rangeForPreset, type DateRangePreset } from '@/lib/date-range';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useBranchPerformanceReport, type BranchPerformanceRow } from '@/lib/hooks/use-reports';
import { isAdminRole } from '@/lib/roles';

// Mirrors Inventra/components/reports/BranchPerformanceClient.tsx —
// Admin/Owner only (get_branch_performance_report is not security
// definer, so a branch-scoped caller would just see zeros for every
// branch but their own — see the RPC's migration comment).
export default function BranchPerformanceScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const currency = useOrgCurrency();
  const profileQuery = useMyProfile();
  const isAdmin = isAdminRole(profileQuery.data?.role ?? '');
  const range = rangeForPreset(preset);
  const query = useBranchPerformanceReport({ from: range.from, to: range.to });

  const { topBranch, lowestBranch } = useMemo(() => {
    const rows = query.data ?? [];
    if (rows.length < 2) return { topBranch: null, lowestBranch: null };
    const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
    return { topBranch: sorted[0], lowestBranch: sorted[sorted.length - 1] };
  }, [query.data]);

  if (!profileQuery.isLoading && !isAdmin) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8 dark:bg-bg-dark">
        <Text className="text-center text-[14px] font-semibold text-text dark:text-text-dark">Admin/Owner only</Text>
        <Text className="mt-1 text-center text-[12.5px] text-text-2 dark:text-text-2-dark">
          Branch performance compares every branch — only an owner or admin can see the full picture.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4" hitSlop={10}>
          <Text className="text-[13px] font-semibold text-accent-text dark:text-accent-text-dark">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <ReportsAccessGate>
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
          </Pressable>
          <Text className="text-[16px] font-bold text-text dark:text-text-dark">Branch Performance</Text>
          <View className="w-12" />
        </View>

        <View className="flex-row flex-wrap gap-2 px-5 pt-4">
          {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((p) => {
            const active = preset === p;
            return (
              <Pressable
                key={p}
                onPress={() => {
                  haptics.select();
                  setPreset(p);
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
                  {PRESET_LABELS[p]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {query.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : query.isError || !query.data ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : (
          <ScrollView contentContainerClassName="gap-4 p-5 pb-10">
            {topBranch && lowestBranch && (
              <View className="flex-row gap-3">
                <View className="flex-1 rounded-[14px] border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                  <Text className="text-[11px] font-semibold text-text-2 dark:text-text-2-dark">Top selling</Text>
                  <Text className="mt-1 text-[14px] font-bold text-text dark:text-text-dark" numberOfLines={1}>
                    {topBranch.branchName}
                  </Text>
                  <Text className="font-mono text-[12.5px] font-bold text-accent-text dark:text-accent-text-dark">{formatMoney(topBranch.revenue, currency)}</Text>
                </View>
                <View className="flex-1 rounded-[14px] border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                  <Text className="text-[11px] font-semibold text-text-2 dark:text-text-2-dark">Lowest performing</Text>
                  <Text className="mt-1 text-[14px] font-bold text-text dark:text-text-dark" numberOfLines={1}>
                    {lowestBranch.branchName}
                  </Text>
                  <Text className="font-mono text-[12.5px] font-bold text-red dark:text-red-dark">{formatMoney(lowestBranch.revenue, currency)}</Text>
                </View>
              </View>
            )}

            <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <Text className="mb-3 text-[13px] font-bold text-text-2 dark:text-text-2-dark">By branch</Text>
              {query.data.length === 0 ? (
                <Text className="text-[12.5px] text-muted dark:text-muted-dark">No branches yet.</Text>
              ) : (
                <View className="gap-3.5">
                  {query.data.map((row) => (
                    <BranchRow key={row.warehouseId} row={row} currency={currency} />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ReportsAccessGate>
  );
}

function BranchRow({ row, currency }: { row: BranchPerformanceRow; currency: string }) {
  return (
    <View className="gap-1.5 border-b border-border pb-3 last:border-b-0 last:pb-0 dark:border-border-dark">
      <Text className="text-[13.5px] font-bold text-text dark:text-text-dark">{row.branchName}</Text>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        <Stat label="Revenue" value={formatMoney(row.revenue, currency)} />
        <Stat label="Profit" value={formatMoney(row.profit, currency)} />
        <Stat label="Expenses" value={formatMoney(row.expenses, currency)} />
        <Stat label="Stock value" value={formatMoney(row.stockValue, currency)} />
        <Stat label="SKUs" value={String(row.skuCount)} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-[10px] text-muted dark:text-muted-dark">{label}</Text>
      <Text className="font-mono text-[12px] font-bold text-text dark:text-text-dark">{value}</Text>
    </View>
  );
}
