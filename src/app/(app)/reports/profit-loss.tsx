import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { PRESET_LABELS, rangeForPreset, type DateRangePreset } from '@/lib/date-range';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useProfitLoss } from '@/lib/hooks/use-reports';

// Mirrors Inventra/components/reports/ProfitLossClient.tsx.
export default function ProfitLossScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const currency = useOrgCurrency();
  const range = rangeForPreset(preset);
  const query = useProfitLoss({ from: range.from, to: range.to });

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Profit &amp; Loss</Text>
        <View className="w-10" />
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
        <ScrollView contentContainerClassName="p-5 pb-10">
          <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <PLRow label="Revenue" value={formatMoney(query.data.revenue, currency)} />
            <PLRow label="Cost of goods sold" value={`-${formatMoney(query.data.cogs, currency)}`} muted />
            <PLRow label="Gross profit" value={formatMoney(query.data.grossProfit, currency)} bold border />
            <PLRow label="Operating expenses" value={`-${formatMoney(query.data.operatingExpenses, currency)}`} muted />
            <View className="mt-2 flex-row items-center justify-between border-t border-border pt-3 dark:border-border-dark">
              <Text className="text-[15px] font-bold text-text dark:text-text-dark">Net profit</Text>
              <Text
                className={`font-mono text-[18px] font-bold ${query.data.netProfit >= 0 ? 'text-green dark:text-green-dark' : 'text-red dark:text-red-dark'}`}
              >
                {formatMoney(query.data.netProfit, currency)}
              </Text>
            </View>
            <Text className="mt-1 text-right text-[11.5px] text-muted dark:text-muted-dark">{query.data.marginPct.toFixed(1)}% margin</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PLRow({ label, value, bold, muted, border }: { label: string; value: string; bold?: boolean; muted?: boolean; border?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between py-2 ${border ? 'border-b border-border-2 dark:border-border-2-dark' : ''}`}>
      <Text className={`text-[13px] ${bold ? 'font-bold text-text dark:text-text-dark' : 'text-text-2 dark:text-text-2-dark'}`}>{label}</Text>
      <Text
        className={`font-mono text-[13.5px] ${bold ? 'font-bold text-text dark:text-text-dark' : muted ? 'text-muted dark:text-muted-dark' : 'font-semibold text-text dark:text-text-dark'}`}
      >
        {value}
      </Text>
    </View>
  );
}
