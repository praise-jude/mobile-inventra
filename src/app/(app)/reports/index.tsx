import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { PRESET_LABELS, rangeForPreset, type DateRangePreset } from '@/lib/date-range';
import { formatMoney, formatNumber } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useSalesReport } from '@/lib/hooks/use-reports';

// Mirrors Inventra/components/reports/SalesReportClient.tsx — condensed to
// stat cards + ranked lists instead of charts (no charting library in this
// app; see AGENTS notes on keeping dependencies lean). By-branch is only
// shown when there's more than one row worth comparing.
export default function SalesReportScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const currency = useOrgCurrency();
  const range = rangeForPreset(preset);
  const query = useSalesReport({ from: range.from, to: range.to }, range.granularity === 'month' ? 'month' : 'day');

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Sales Report</Text>
        <Pressable onPress={() => router.push('/reports/profit-loss')} hitSlop={10}>
          <Text className="text-[13px] font-semibold text-accent-text dark:text-accent-text-dark">P&amp;L</Text>
        </Pressable>
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
          <View className="flex-row flex-wrap gap-3">
            <StatCard label="Revenue" value={formatMoney(query.data.summary.revenue, currency)} />
            <StatCard label="Profit" value={formatMoney(query.data.summary.profit, currency)} />
            <StatCard label="Sales" value={formatNumber(query.data.summary.salesCount)} />
            <StatCard label="Discounts given" value={formatMoney(query.data.summary.discount, currency)} />
          </View>

          <Section title="By period">
            {query.data.byPeriod.length === 0 ? (
              <EmptyRow text="No sales in this period." />
            ) : (
              query.data.byPeriod.map((row) => (
                <Row key={row.period} left={new Date(row.period).toLocaleDateString()} right={formatMoney(row.revenue, currency)} sub={`${row.salesCount} sale${row.salesCount === 1 ? '' : 's'}`} />
              ))
            )}
          </Section>

          <Section title="Top products">
            {query.data.byProduct.length === 0 ? (
              <EmptyRow text="No product sales in this period." />
            ) : (
              query.data.byProduct
                .slice()
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10)
                .map((row) => <Row key={row.productId} left={row.name} right={formatMoney(row.revenue, currency)} sub={`${row.units} sold`} />)
            )}
          </Section>

          {query.data.byBranch.length > 1 && (
            <Section title="By branch">
              {query.data.byBranch.map((row) => (
                <Row key={row.warehouseId} left={row.warehouseName} right={formatMoney(row.revenue, currency)} sub={`${row.salesCount} sale${row.salesCount === 1 ? '' : 's'}`} />
              ))}
            </Section>
          )}

          <Section title="By staff">
            {query.data.byStaff.length === 0 ? (
              <EmptyRow text="No sales recorded yet." />
            ) : (
              query.data.byStaff.map((row) => (
                <Row key={row.staffId ?? row.staffName} left={row.staffName} right={formatMoney(row.revenue, currency)} sub={`${row.salesCount} sale${row.salesCount === 1 ? '' : 's'}`} />
              ))
            )}
          </Section>

          <Pressable
            onPress={() => router.push('/reports/inventory-valuation')}
            className="items-center rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
          >
            <Text className="text-[13px] font-semibold text-accent-text dark:text-accent-text-dark">View inventory valuation →</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[47%] flex-1 rounded-[14px] border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
      <Text className="text-[11.5px] font-semibold text-text-2 dark:text-text-2-dark">{label}</Text>
      <Text className="mt-1.5 font-mono text-[17px] font-bold text-text dark:text-text-dark">{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <Text className="mb-3 text-[13px] font-bold text-text-2 dark:text-text-2-dark">{title}</Text>
      <View className="gap-2.5">{children}</View>
    </View>
  );
}

function Row({ left, right, sub }: { left: string; right: string; sub?: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-2">
        <Text className="text-[13px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
          {left}
        </Text>
        {sub && <Text className="text-[11px] text-muted dark:text-muted-dark">{sub}</Text>}
      </View>
      <Text className="font-mono text-[13px] font-bold text-text dark:text-text-dark">{right}</Text>
    </View>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <Text className="text-[12.5px] text-muted dark:text-muted-dark">{text}</Text>;
}
