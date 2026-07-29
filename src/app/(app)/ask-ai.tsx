import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { logAudit } from '@/lib/actions/audit';
import { formatMoney, formatNumber } from '@/lib/format';
import { useBusinessInsights } from '@/lib/hooks/use-business-insights';
import { useMyProfile } from '@/lib/hooks/use-my-profile';

// "Ask AI" v1 — see use-business-insights.ts's header comment: this is
// pre-computed insight cards over the org's real data, not a free-text
// LLM chat. The screen says so plainly rather than implying a capability
// (open-ended natural language Q&A) it doesn't have.
function Card({ icon, question, children }: { icon: string; question: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <View className="mb-2.5 flex-row items-center gap-2">
        <Text className="text-[16px]">{icon}</Text>
        <Text className="flex-1 text-[13.5px] font-bold text-text dark:text-text-dark">{question}</Text>
      </View>
      {children}
    </View>
  );
}

function Answer({ children }: { children: React.ReactNode }) {
  return <Text className="text-[13px] leading-snug text-text-2 dark:text-text-2-dark">{children}</Text>;
}

const SEVERITY_STYLE: Record<'critical' | 'warning' | 'info', string> = {
  critical: 'bg-red-weak dark:bg-red-weak-dark',
  warning: 'bg-amber-weak dark:bg-amber-weak-dark',
  info: 'bg-sky-weak dark:bg-sky-weak-dark',
};
const SEVERITY_TEXT: Record<'critical' | 'warning' | 'info', string> = {
  critical: 'text-red dark:text-red-dark',
  warning: 'text-amber dark:text-amber-dark',
  info: 'text-sky dark:text-sky-dark',
};

function healthColor(score: number): string {
  if (score >= 70) return 'text-green dark:text-green-dark';
  if (score >= 40) return 'text-amber dark:text-amber-dark';
  return 'text-red dark:text-red-dark';
}

export default function AskAiScreen() {
  const query = useBusinessInsights();
  const profileQuery = useMyProfile();

  // Once per mount, not once per react-query background refetch — this is
  // a "viewed Ask AI" usage signal, not something that should spam a new
  // entry every time the underlying insights silently revalidate.
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current || !query.isSuccess || !profileQuery.data) return;
    logged.current = true;
    const profile = profileQuery.data;
    void logAudit({
      orgId: profile.org_id,
      actorId: profile.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: 'ai.viewed',
      module: 'Ask AI',
      entityType: 'business_insights',
    });
  }, [query.isSuccess, profileQuery.data]);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Ask AI</Text>
        <View className="w-12" />
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </View>
      ) : query.isError || !query.data ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10">
          <Text className="text-[12px] leading-snug text-muted dark:text-muted-dark">
            Instant answers computed from your business data — no typing needed, updates every time you open this screen.
          </Text>

          <InsightCards data={query.data} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function InsightCards({ data }: { data: NonNullable<ReturnType<typeof useBusinessInsights>['data']> }) {
  const {
    currency,
    todaysProfit,
    todaysSalesCount,
    todaysSalesTotal,
    topSellers,
    lowStockItems,
    outOfStockCount,
    restockSuggestions,
    deadStock,
    debtors,
    debtorsLocked,
    totalOwed,
    highExpenseCategory,
    stockoutForecasts,
    alerts,
    health,
    forecast,
  } = data;

  const recommendations: string[] = [];
  const lowStockTopSeller = restockSuggestions.find((r) => topSellers.some((t) => t.productId === r.id));
  if (lowStockTopSeller) {
    recommendations.push(`${lowStockTopSeller.name} is one of your best sellers but running low — restock it soon to avoid losing sales.`);
  }
  if (highExpenseCategory) {
    recommendations.push(`${highExpenseCategory.label} is ${highExpenseCategory.pct}% of your last 30 days of expenses — worth a closer look.`);
  }
  if (deadStock.length > 0) {
    recommendations.push(`${deadStock.length} product${deadStock.length === 1 ? " hasn't" : "s haven't"} sold in 30 days — consider a promotion or discount to move it.`);
  }
  if (!debtorsLocked && totalOwed > 0) {
    recommendations.push(`${formatMoney(totalOwed, currency)} is owed by customers — following up could improve cash flow this week.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('No red flags right now — keep an eye on stock levels and expenses as they change.');
  }

  return (
    <>
      <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-[13.5px] font-bold text-text dark:text-text-dark">Business Health Score</Text>
          <Text className={`font-mono text-[22px] font-bold ${healthColor(health.overall)}`}>{health.overall}</Text>
        </View>
        <View className="gap-2">
          {health.dimensions.map((d) => (
            <View key={d.label}>
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-[12px] font-semibold text-text-2 dark:text-text-2-dark">{d.label}</Text>
                <Text className={`font-mono text-[12px] font-bold ${d.score === null ? 'text-muted dark:text-muted-dark' : healthColor(d.score)}`}>
                  {d.score === null ? 'N/A' : d.score}
                </Text>
              </View>
              {d.score !== null && (
                <View className="h-1.5 overflow-hidden rounded-full bg-border-2 dark:bg-border-2-dark">
                  <View
                    className={`h-full rounded-full ${d.score >= 70 ? 'bg-green dark:bg-green-dark' : d.score >= 40 ? 'bg-amber dark:bg-amber-dark' : 'bg-red dark:bg-red-dark'}`}
                    style={{ width: `${d.score}%` }}
                  />
                </View>
              )}
              <Text className="mt-0.5 text-[11px] text-muted dark:text-muted-dark">{d.insight}</Text>
            </View>
          ))}
        </View>
      </View>

      {alerts.length > 0 && (
        <View className="gap-2">
          {alerts.map((a) => (
            <View key={a.id} className={`flex-row items-center gap-2.5 rounded-2xl p-3.5 ${SEVERITY_STYLE[a.severity]}`}>
              <Text className="text-[16px]">{a.icon}</Text>
              <Text className={`flex-1 text-[12.5px] font-semibold ${SEVERITY_TEXT[a.severity]}`}>{a.message}</Text>
            </View>
          ))}
        </View>
      )}

      {forecast && (
        <Card icon="🔮" question="Forecast my sales for next month">
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Projected revenue</Text>
              <Text className="font-mono text-[16px] font-bold text-text dark:text-text-dark">{formatMoney(forecast.revenue, currency)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Projected profit</Text>
              <Text className="font-mono text-[16px] font-bold text-text dark:text-text-dark">{formatMoney(forecast.profit, currency)}</Text>
            </View>
          </View>
          <Text className="mt-2 text-[11px] text-muted dark:text-muted-dark">
            {forecast.confidence === 'high' ? 'Based on 6+ months of trend — ' : forecast.confidence === 'medium' ? 'Based on a few months of trend — ' : 'Based on limited history — '}
            a simple projection, not a guarantee.
          </Text>
        </Card>
      )}

      <Card icon="💰" question="How much profit did I make today?">
        <Text className={`font-mono text-[20px] font-bold ${todaysProfit >= 0 ? 'text-green dark:text-green-dark' : 'text-red dark:text-red-dark'}`}>
          {formatMoney(todaysProfit, currency)}
        </Text>
      </Card>

      <Card icon="🧾" question="Today's sales summary">
        <Answer>
          {todaysSalesCount === 0
            ? "No sales recorded yet today."
            : `${formatNumber(todaysSalesCount)} sale${todaysSalesCount === 1 ? '' : 's'} totaling ${formatMoney(todaysSalesTotal, currency)}.`}
        </Answer>
      </Card>

      <Card icon="🚀" question="Which products sell the fastest?">
        {topSellers.length === 0 ? (
          <Answer>No sales in the last 30 days yet.</Answer>
        ) : (
          <View className="gap-1.5">
            {topSellers.map((p, i) => (
              <View key={p.productId} className="flex-row items-center justify-between">
                <Text className="flex-1 text-[13px] text-text dark:text-text-dark" numberOfLines={1}>
                  {i + 1}. {p.emoji ?? '📦'} {p.name}
                </Text>
                <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">{formatNumber(p.units)} sold</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card icon="📉" question="Which items are low in stock?">
        {lowStockItems.length === 0 ? (
          <Answer>Nothing is low or out of stock right now.</Answer>
        ) : (
          <View className="gap-1.5">
            {outOfStockCount > 0 && (
              <Text className="text-[12px] font-semibold text-red dark:text-red-dark">{outOfStockCount} item(s) completely out of stock</Text>
            )}
            {lowStockItems.slice(0, 6).map((p) => (
              <View key={p.id} className="flex-row items-center justify-between">
                <Text className="flex-1 text-[13px] text-text dark:text-text-dark" numberOfLines={1}>
                  {p.emoji ?? '📦'} {p.name}
                </Text>
                <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">{p.qtyOnHand} left</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card icon="📦" question="Suggest products to restock">
        {restockSuggestions.length === 0 ? (
          <Answer>Nothing needs restocking right now.</Answer>
        ) : (
          <View className="gap-1.5">
            {restockSuggestions.map((p) => (
              <Text key={p.id} className="text-[13px] text-text dark:text-text-dark" numberOfLines={1}>
                {p.emoji ?? '📦'} {p.name} — {p.qtyOnHand} left
              </Text>
            ))}
          </View>
        )}
      </Card>

      <Card icon="😴" question="What products haven't sold this month?">
        {deadStock.length === 0 ? (
          <Answer>Everything active has sold at least once in the last 30 days.</Answer>
        ) : (
          <View className="gap-1.5">
            {deadStock.map((p) => (
              <Text key={p.id} className="text-[13px] text-text dark:text-text-dark" numberOfLines={1}>
                {p.emoji ?? '📦'} {p.name} — {p.qtyOnHand} in stock
              </Text>
            ))}
          </View>
        )}
      </Card>

      <Card icon="💸" question="Which customers owe me money?">
        {debtorsLocked ? (
          <Pressable onPress={() => router.push('/billing')}>
            <View className="flex-row items-center gap-2">
              <View className="rounded-full bg-accent-weak px-2 py-0.5 dark:bg-accent-weak-dark">
                <Text className="text-[10px] font-bold text-accent-text dark:text-accent-text-dark">PREMIUM</Text>
              </View>
              <Text className="flex-1 text-[13px] text-accent-text dark:text-accent-text-dark">Customer credit tracking is a Premium feature — tap to upgrade.</Text>
            </View>
          </Pressable>
        ) : debtors.length === 0 ? (
          <Answer>No outstanding customer debt right now.</Answer>
        ) : (
          <View className="gap-1.5">
            <Text className="mb-1 text-[12px] font-semibold text-text-2 dark:text-text-2-dark">
              {formatMoney(totalOwed, currency)} owed in total
            </Text>
            {debtors.map((d) => (
              <View key={d.id} className="flex-row items-center justify-between">
                <Text className="flex-1 text-[13px] text-text dark:text-text-dark" numberOfLines={1}>
                  {d.customerName}
                </Text>
                <Text className="font-mono text-[12px] font-bold text-text dark:text-text-dark">{formatMoney(d.amountOwed, currency)}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card icon="⚠️" question="What expenses are unusually high?">
        {highExpenseCategory ? (
          <Answer>
            {highExpenseCategory.label} makes up {highExpenseCategory.pct}% of your expenses over the last 30 days ({formatMoney(highExpenseCategory.amount, currency)}).
          </Answer>
        ) : (
          <Answer>No expense category stands out as unusually high right now.</Answer>
        )}
      </Card>

      <Card icon="⏳" question="Predict when stock will run out">
        {stockoutForecasts.length === 0 ? (
          <Answer>Not enough recent sales data to predict a stockout for any product.</Answer>
        ) : (
          <View className="gap-1.5">
            {stockoutForecasts.slice(0, 5).map((f) => (
              <View key={f.productId} className="flex-row items-center justify-between">
                <Text className="flex-1 text-[13px] text-text dark:text-text-dark" numberOfLines={1}>
                  {f.emoji ?? '📦'} {f.name}
                </Text>
                <Text
                  className={`font-mono text-[12px] font-bold ${f.daysLeft <= 7 ? 'text-red dark:text-red-dark' : 'text-text-2 dark:text-text-2-dark'}`}
                >
                  ~{f.daysLeft}d left
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card icon="💡" question="Recommend ways to improve profits">
        <View className="gap-1.5">
          {recommendations.map((r, i) => (
            <Answer key={i}>• {r}</Answer>
          ))}
        </View>
      </Card>
    </>
  );
}
