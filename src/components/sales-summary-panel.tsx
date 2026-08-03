import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { PlaceholderTextColor } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useDailySalesSummary, useSalesForDay, type DailySalesSummaryRow } from '@/lib/hooks/use-sales-summary';

type Preset = 'today' | 'yesterday' | '7d' | 'thisMonth' | 'lastMonth' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const today = isoDate(now);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: isoDate(y), to: isoDate(y) };
    }
    case '7d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { from: isoDate(s), to: today };
    }
    case 'thisMonth':
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'lastMonth': {
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: isoDate(lastMonthStart), to: isoDate(lastMonthEnd) };
    }
  }
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-[47%]">
      <Text className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-muted dark:text-muted-dark">{label}</Text>
      <Text className="mt-0.5 text-[15px] font-bold text-text dark:text-text-dark">{value}</Text>
    </View>
  );
}

// Mirrors Inventra/components/audit/SalesSummaryPanel.tsx — same monthly
// card + filterable daily breakdown + per-day drill-down, backed by the
// same shared RPC/tables, so mobile and web numbers agree by construction.
export function SalesSummaryPanel({ monthLabel }: { monthLabel: string }) {
  const currency = useOrgCurrency();
  const [preset, setPreset] = useState<Preset>('thisMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const monthRange = useMemo(() => presetRange('thisMonth'), []);
  const monthQuery = useDailySalesSummary(monthRange.from, monthRange.to);

  const activeRange = preset === 'custom' ? { from: customFrom, to: customTo } : presetRange(preset);
  const dailyQuery = useDailySalesSummary(activeRange.from, activeRange.to);
  const dayQuery = useSalesForDay(expandedDay);

  const monthRows = monthQuery.data ?? [];
  const monthTotal = monthRows.reduce((sum, r) => sum + r.totalSales, 0);
  const monthTransactions = monthRows.reduce((sum, r) => sum + r.salesCount, 0);
  const daysElapsedInMonth = new Date().getDate();
  const avgDaily = daysElapsedInMonth > 0 ? monthTotal / daysElapsedInMonth : 0;
  const daysWithSales = monthRows.filter((r) => r.salesCount > 0);
  const highestDay = daysWithSales.length > 0 ? Math.max(...daysWithSales.map((r) => r.totalSales)) : null;
  const lowestDay = daysWithSales.length > 0 ? Math.min(...daysWithSales.map((r) => r.totalSales)) : null;

  const sortedRows = [...(dailyQuery.data ?? [])].sort((a, b) => (a.day < b.day ? 1 : -1));

  function toggleDay(day: string) {
    setExpandedDay((current) => (current === day ? null : day));
  }

  return (
    <View className="gap-3 pb-3 pt-1">
      <View className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
        <Text className="mb-2.5 text-[14px] font-bold text-text dark:text-text-dark">{monthLabel} · Sales Summary</Text>
        <View className="flex-row flex-wrap gap-y-2.5">
          <SummaryStat label="Total Sales" value={formatMoney(monthTotal, currency)} />
          <SummaryStat label="Transactions" value={monthTransactions.toLocaleString('en-US')} />
          <SummaryStat label="Avg Daily Sales" value={formatMoney(avgDaily, currency)} />
          <SummaryStat label="Highest Day" value={highestDay !== null ? formatMoney(highestDay, currency) : '—'} />
          <SummaryStat label="Lowest Day" value={lowestDay !== null ? formatMoney(lowestDay, currency) : '—'} />
        </View>
      </View>

      <View className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
        <Text className="mb-2 text-[12.5px] font-bold text-text-2 dark:text-text-2-dark">Daily breakdown</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = preset === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => setPreset(p.key)}
                className={`rounded-full border px-2.5 py-1.5 ${active ? 'border-accent bg-accent-weak dark:border-accent-dark dark:bg-accent-weak-dark' : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'}`}
              >
                <Text className={`text-[11.5px] font-semibold ${active ? 'text-accent-text dark:text-accent-text-dark' : 'text-text-2 dark:text-text-2-dark'}`}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {preset === 'custom' && (
          <View className="mt-2.5 flex-row gap-2">
            <TextInput
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="From (YYYY-MM-DD)"
              placeholderTextColor={PlaceholderTextColor}
              className="h-[38px] flex-1 rounded-[8px] border border-border bg-surface px-2.5 text-[12.5px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
            <TextInput
              value={customTo}
              onChangeText={setCustomTo}
              placeholder="To (YYYY-MM-DD)"
              placeholderTextColor={PlaceholderTextColor}
              className="h-[38px] flex-1 rounded-[8px] border border-border bg-surface px-2.5 text-[12.5px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
          </View>
        )}

        <View className="mt-3 gap-2">
          {dailyQuery.isLoading ? (
            <ActivityIndicator className="py-3" />
          ) : dailyQuery.isError ? (
            <Text className="py-2 text-center text-[12px] text-muted dark:text-muted-dark">Could not load the sales summary.</Text>
          ) : sortedRows.length === 0 ? (
            <Text className="py-2 text-center text-[12px] text-muted dark:text-muted-dark">No sales in this range.</Text>
          ) : (
            sortedRows.map((r: DailySalesSummaryRow) => (
              <View key={r.day} className="rounded-[10px] border border-border-2 dark:border-border-2-dark">
                <Pressable onPress={() => toggleDay(r.day)} className="p-2.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 text-[12px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
                      {dayLabel(r.day)}
                    </Text>
                    <Text className="text-[10px] text-muted dark:text-muted-dark">{expandedDay === r.day ? '▲' : '▼'}</Text>
                  </View>
                  <View className="mt-1 flex-row items-center gap-3">
                    <Text className="text-[12.5px] font-bold text-text dark:text-text-dark">{formatMoney(r.totalSales, currency)}</Text>
                    <Text className="text-[11px] text-text-2 dark:text-text-2-dark">{r.salesCount} sales</Text>
                    <Text className="text-[11px] text-text-2 dark:text-text-2-dark">{r.itemsSold} items</Text>
                  </View>
                </Pressable>

                {expandedDay === r.day && (
                  <View className="border-t border-border-2 p-2.5 dark:border-border-2-dark">
                    {dayQuery.isLoading ? (
                      <ActivityIndicator className="py-2" />
                    ) : !dayQuery.data || dayQuery.data.length === 0 ? (
                      <Text className="py-1 text-center text-[11.5px] text-muted dark:text-muted-dark">No sales found for this day.</Text>
                    ) : (
                      <View className="gap-2">
                        {dayQuery.data.map((s) => (
                          <View key={s.id} className="flex-row items-center justify-between">
                            <View className="flex-1 pr-2">
                              <Text className="text-[11.5px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
                                {s.customerName}
                              </Text>
                              <Text className="text-[10.5px] text-muted dark:text-muted-dark" numberOfLines={1}>
                                {s.cashierName} · {s.paymentSummary} ·{' '}
                                {new Date(s.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </Text>
                            </View>
                            <Text className="text-[12px] font-bold text-text dark:text-text-dark">{formatMoney(s.total, currency)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}
