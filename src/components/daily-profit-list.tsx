import { Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { formatMoney, formatNumber } from '@/lib/format';
import type { DailyProductProfitRow } from '@/types/database';

// Simplified mobile equivalent of Inventra/components/dashboard/
// DailyProfitTable.tsx — that one is a full sortable/searchable data grid
// (components/ui/Table), which has no mobile counterpart; this renders the
// same per-product cost/revenue/profit breakdown as stacked rows, sorted by
// profit descending, matching how every other mobile screen condenses
// web's data-table views (see Reports screens' header comment).
export function DailyProfitList({ rows, currency }: { rows: DailyProductProfitRow[]; currency: string }) {
  if (rows.length === 0) {
    return <EmptyState icon="💰" title="No sales recorded today yet" description="Today's per-product profit will appear here once a sale is made." />;
  }

  const sorted = [...rows].sort((a, b) => (Number(b.profit) || 0) - (Number(a.profit) || 0));

  return (
    <View className="gap-3">
      {sorted.map((p) => {
        const profit = Number(p.profit) || 0;
        return (
          <View key={p.product_id} className="flex-row items-center justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Text className="text-[14px]">{p.emoji || '📦'}</Text>
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text className="text-[11px] text-muted dark:text-muted-dark">
                  {formatNumber(Number(p.units) || 0)} sold · {formatMoney(Number(p.revenue) || 0, currency)} revenue
                </Text>
              </View>
            </View>
            <Text className={`font-mono text-[13px] font-bold ${profit >= 0 ? 'text-green dark:text-green-dark' : 'text-red dark:text-red-dark'}`}>
              {formatMoney(profit, currency)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
