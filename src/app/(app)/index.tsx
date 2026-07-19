import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { useAuth } from '@/lib/auth-context';
import { formatMoney, formatNumber, formatPct, formatTodayHeader, greetingFor, pctDelta, timeAgo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useHasPermission } from '@/lib/hooks/use-permissions';
import { MOVEMENT_META } from '@/lib/movement-meta';
import { isManagerRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { StockHealthRow } from '@/types/database';

// Mirrors Inventra/app/(app)/dashboard/page.tsx, trimmed to what fits a
// mobile home screen: KPI grid, stock health, top sellers, recent activity.
// Charts/category-mix/expense-breakdown/team-presence/daily-profit-table are
// deliberately out of scope for this pass — see the (app) tab shell's
// <ComingSoon /> sections for those.
const STOCK_HEALTH_META: Record<string, { label: string; barClass: string }> = {
  in_stock: { label: 'Healthy stock', barClass: 'bg-green dark:bg-green-dark' },
  low_stock: { label: 'Low stock', barClass: 'bg-amber dark:bg-amber-dark' },
  out_of_stock: { label: 'Out of stock', barClass: 'bg-red dark:bg-red-dark' },
  expiring: { label: 'Expiring < 7 days', barClass: 'bg-sky dark:bg-sky-dark' },
};

interface ActivityRow {
  id: string;
  type: string;
  qty_delta: number;
  reason: string | null;
  created_at: string;
  products: { name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
}

export default function DashboardScreen() {
  const { session } = useAuth();

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', session?.user.id],
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .single();
      if (profileError) throw profileError;

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single();
      if (orgError) throw orgError;

      const isManagerTier = isManagerRole(profile.role);

      const [kpisRes, topSellersRes, stockHealthRes, activityRes] = await Promise.all([
        supabase.rpc('get_kpis'),
        supabase.rpc('get_top_sellers', { p_limit: 5 }),
        supabase.rpc('get_stock_health'),
        supabase
          .from('stock_movements')
          .select('id, type, qty_delta, reason, created_at, products(name), profiles(first_name, last_name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      if (kpisRes.error) throw kpisRes.error;
      if (topSellersRes.error) throw topSellersRes.error;
      if (stockHealthRes.error) throw stockHealthRes.error;
      if (activityRes.error) throw activityRes.error;

      return {
        profile,
        org,
        isManagerTier,
        kpis: kpisRes.data,
        topSellers: topSellersRes.data ?? [],
        stockHealth: (stockHealthRes.data ?? []) as StockHealthRow[],
        activity: (activityRes.data ?? []) as unknown as ActivityRow[],
      };
    },
    enabled: !!session,
  });
  const reportsPermissionQuery = useHasPermission('reports', 'view');

  function handleRefresh() {
    void dashboardQuery.refetch();
  }

  if (dashboardQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="gap-3 px-5 pt-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <View className="mt-3 flex-row flex-wrap gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] w-[47%]" />
            ))}
          </View>
          <Skeleton className="mt-3 h-40 w-full" />
          <Skeleton className="mt-3 h-52 w-full" />
        </View>
      </SafeAreaView>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <ErrorState onRetry={handleRefresh} />
      </SafeAreaView>
    );
  }

  const { profile, org, isManagerTier, kpis, topSellers, stockHealth, activity } = dashboardQuery.data;
  const greeting = greetingFor(org.timezone);
  const today = formatTodayHeader(org.timezone);
  const totalStock = stockHealth.reduce((sum, s) => (s.label === 'expiring' ? sum : sum + Number(s.count)), 0);

  const kpiCards = [
    {
      key: 'products',
      label: 'Total products',
      value: formatNumber(kpis.total_products),
      sub: 'active SKUs',
      show: true,
    },
    {
      key: 'revenue',
      label: "Today's revenue",
      value: formatMoney(kpis.today_revenue, org.currency),
      sub: 'vs yesterday',
      delta: formatPct(pctDelta(kpis.today_revenue, kpis.yesterday_revenue)),
      deltaUp: kpis.today_revenue >= kpis.yesterday_revenue,
      show: isManagerTier,
    },
    {
      key: 'profit',
      label: 'Monthly profit',
      value: kpis.monthly_profit !== null ? formatMoney(kpis.monthly_profit, org.currency) : '—',
      sub: 'vs last month',
      delta: formatPct(pctDelta(kpis.monthly_profit ?? 0, kpis.prior_monthly_profit)),
      deltaUp: (kpis.monthly_profit ?? 0) >= (kpis.prior_monthly_profit ?? 0),
      show: isManagerTier,
    },
    {
      key: 'low_stock',
      label: 'Low stock',
      value: formatNumber(kpis.low_stock_count),
      sub: 'need reorder',
      show: true,
    },
    {
      key: 'out_of_stock',
      label: 'Out of stock',
      value: formatNumber(kpis.out_of_stock_count),
      sub: 'SKUs',
      show: true,
    },
    {
      key: 'inventory_value',
      label: 'Inventory value',
      value: formatMoney(kpis.total_inventory_value ?? 0, org.currency),
      sub: 'selling price × stock',
      show: isManagerTier,
    },
  ].filter((c) => c.show);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView
        contentContainerClassName="px-5 pb-10 pt-2"
        refreshControl={<RefreshControl refreshing={dashboardQuery.isRefetching} onRefresh={handleRefresh} />}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">
              {greeting.emoji} {greeting.label}, {profile.first_name}
            </Text>
            <Text className="mt-0.5 text-[13px] text-text-2 dark:text-text-2-dark">{today}</Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push('/notifications');
            }}
            hitSlop={10}
            className="h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
          >
            <Text className="text-[15px]">🔔</Text>
          </Pressable>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-3">
          {kpiCards.map((k) => (
            <View
              key={k.key}
              className="min-w-[47%] flex-1 rounded-[14px] border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
            >
              <Text className="text-[11.5px] font-semibold text-text-2 dark:text-text-2-dark">{k.label}</Text>
              <Text className="mt-1.5 font-mono text-[19px] font-bold text-text dark:text-text-dark">{k.value}</Text>
              <View className="mt-1 flex-row items-center gap-1.5">
                {'delta' in k && k.delta && (
                  <Text
                    className={`rounded-[6px] px-1.5 py-px text-[11px] font-bold ${
                      k.deltaUp
                        ? 'bg-green-weak text-green dark:bg-green-weak-dark dark:text-green-dark'
                        : 'bg-red-weak text-red dark:bg-red-weak-dark dark:text-red-dark'
                    }`}
                  >
                    {k.delta}
                  </Text>
                )}
                <Text className="text-[10.5px] text-muted dark:text-muted-dark">{k.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-5 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Text className="mb-0.5 text-[15px] font-bold text-text dark:text-text-dark">Stock health</Text>
          <Text className="mb-3.5 text-[12px] text-muted dark:text-muted-dark">Across your catalog</Text>
          <View className="gap-3">
            {stockHealth.map((s) => {
              const meta = STOCK_HEALTH_META[s.label];
              const pct = Math.min(100, Math.round((Number(s.count) / Math.max(totalStock, 1)) * 100));
              return (
                <View key={s.label}>
                  <View className="mb-1.5 flex-row justify-between">
                    <Text className="text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">
                      {meta?.label ?? s.label}
                    </Text>
                    <Text className="font-mono text-[12.5px] font-bold text-text dark:text-text-dark">
                      {formatNumber(s.count)}
                    </Text>
                  </View>
                  <View className="h-2 overflow-hidden rounded-[6px] bg-border-2 dark:bg-border-2-dark">
                    <View className={`h-full rounded-[6px] ${meta?.barClass ?? 'bg-accent'}`} style={{ width: `${pct}%` }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Text className="mb-3.5 text-[15px] font-bold text-text dark:text-text-dark">Top sellers</Text>
          {topSellers.length === 0 ? (
            <EmptyState
              compact
              icon="🧾"
              title="No sales yet"
              description="Top sellers will show up here once you record your first sale."
            />
          ) : (
            <View className="gap-3">
              {topSellers.map((p) => (
                <View key={p.product_id} className="flex-row items-center gap-2.5">
                  <View className="h-[34px] w-[34px] items-center justify-center rounded-[8px] bg-accent-weak dark:bg-accent-weak-dark">
                    <Text className="text-[16px]">{p.emoji || '📦'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark">{formatNumber(p.units)} sold</Text>
                  </View>
                  <View className="items-end">
                    {isManagerTier && (
                      <Text className="font-mono text-[13px] font-bold text-text dark:text-text-dark">
                        {formatMoney(p.revenue, org.currency)}
                      </Text>
                    )}
                    {p.trend_pct !== null && (
                      <Text
                        className={`text-[11px] font-semibold ${p.trend_pct >= 0 ? 'text-green dark:text-green-dark' : 'text-red dark:text-red-dark'}`}
                      >
                        {formatPct(p.trend_pct, 0)}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <View className="mb-3.5 flex-row items-center justify-between">
            <Text className="text-[15px] font-bold text-text dark:text-text-dark">Recent activity</Text>
            <View className="h-[7px] w-[7px] rounded-full bg-green dark:bg-green-dark" />
          </View>
          {activity.length === 0 ? (
            <EmptyState
              compact
              icon="🕒"
              title="No activity yet"
              description="Stock movements and edits will show up here as your team works."
            />
          ) : (
            <View className="gap-3.5">
              {activity.map((a) => {
                const meta = MOVEMENT_META[a.type] ?? MOVEMENT_META.adjustment;
                const who = a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}` : 'System';
                const productName = a.products?.name ?? 'a product';
                return (
                  <View key={a.id} className="flex-row gap-2.5">
                    <View className={`h-[26px] w-[26px] items-center justify-center rounded-[7px] ${meta.bgClass}`}>
                      <Text className="text-[12px]">{meta.icon}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[12.5px] leading-snug text-text dark:text-text-dark">
                        <Text className="font-bold">{who}</Text> {meta.verb}{' '}
                        {a.type === 'transfer' ? productName : `${Math.abs(a.qty_delta)}× ${productName}`}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-muted dark:text-muted-dark">{timeAgo(a.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {reportsPermissionQuery.data === true && (
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push('/reports');
            }}
            className="mt-4 flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
          >
            <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
              <Text className="text-[18px]">📈</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-semibold text-text dark:text-text-dark">Reports</Text>
              <Text className="text-[11.5px] text-muted dark:text-muted-dark">Sales trends, profit &amp; loss, inventory valuation</Text>
            </View>
            <Text className="text-text-2 dark:text-text-2-dark">›</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
