import { Text, View } from 'react-native';

import type { Entitlements } from '@/lib/entitlements';

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nearLimit = pct >= 90;
  return (
    <View>
      <View className="mb-1.5 flex-row items-baseline justify-between">
        <Text className="text-[12.5px] font-semibold text-text dark:text-text-dark">{label}</Text>
        <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </Text>
      </View>
      <View className="h-2 w-full overflow-hidden rounded-full bg-border-2 dark:bg-border-2-dark">
        <View
          className={`h-full rounded-full ${nearLimit ? 'bg-red dark:bg-red-dark' : 'bg-accent dark:bg-accent-dark'}`}
          style={{ width: `${pct}%` }}
        />
      </View>
    </View>
  );
}

// Mirrors Inventra/components/billing/UsageDashboard.tsx — Current Plan +
// per-resource progress bars, shown on the Billing screen (Settings >
// Subscription equivalent).
export function UsageDashboard({ entitlements }: { entitlements: Entitlements }) {
  const isPremium = entitlements.tier === 'premium';

  return (
    <View className="mb-5 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">Current Plan</Text>
          <Text className="text-[17px] font-bold text-text dark:text-text-dark">{isPremium ? 'Premium' : 'Free'}</Text>
        </View>
        {!isPremium && (
          <View className="rounded-full bg-accent-weak px-2.5 py-1 dark:bg-accent-weak-dark">
            <Text className="text-[10.5px] font-bold text-accent-text dark:text-accent-text-dark">Usage limits apply</Text>
          </View>
        )}
      </View>

      {isPremium ? (
        <Text className="text-[13px] text-text-2 dark:text-text-2-dark">
          Unlimited products, sales, expenses, and customer credit records.
        </Text>
      ) : (
        <View className="gap-3">
          <UsageBar label="Products Used" used={entitlements.productCount} limit={entitlements.productLimit} />
          <UsageBar label="Sales Used" used={entitlements.salesCount} limit={entitlements.salesLimit} />
          <UsageBar label="Expenses Used" used={entitlements.expenseCount} limit={entitlements.expenseLimit} />
          <UsageBar label="Debt Records Used" used={entitlements.debtorCount} limit={entitlements.debtorLimit} />
        </View>
      )}
    </View>
  );
}
