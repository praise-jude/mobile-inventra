import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { useEntitlements } from '@/lib/hooks/use-entitlements';
import { supabase } from '@/lib/supabase';
import type { DashboardKpis, ExpenseCategory, MonthlyRevenueProfitRow } from '@/types/database';

// "Ask AI" v1 — no LLM. Every card here is a plain, deterministic
// computation over the org's own existing data (same tables/RPCs the
// Dashboard already reads), not a language model. A real natural-language
// assistant needs a server-side LLM proxy and a per-request budget — a
// separate, larger decision — so this answers the same questions the
// prompt asked for using arithmetic instead, at zero API cost.

export interface LowStockItem {
  id: string;
  name: string;
  emoji: string | null;
  qtyOnHand: number;
  reorderLevel: number;
  status: 'low_stock' | 'out_of_stock';
}

export interface DeadStockItem {
  id: string;
  name: string;
  emoji: string | null;
  qtyOnHand: number;
}

export interface DebtorInsight {
  id: string;
  customerName: string;
  amountOwed: number;
}

export interface StockoutForecast {
  productId: string;
  name: string;
  emoji: string | null;
  daysLeft: number;
}

export interface ExpenseFlag {
  category: ExpenseCategory;
  label: string;
  amount: number;
  pct: number;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface BusinessAlert {
  id: string;
  severity: AlertSeverity;
  icon: string;
  message: string;
}

export interface HealthDimension {
  label: string;
  score: number | null; // null = not enough data to score this dimension
  insight: string;
}

export interface BusinessHealth {
  overall: number; // average of every scoreable dimension, 0-100
  dimensions: HealthDimension[];
}

export interface MonthlyForecast {
  revenue: number;
  profit: number;
  // Trailing 3-month average month-over-month growth rate used to project
  // next month — an honest linear estimate, not a real predictive model.
  confidence: 'low' | 'medium' | 'high';
}

export interface BusinessInsights {
  currency: string;
  timezone: string;
  todaysProfit: number;
  todaysSalesCount: number;
  todaysSalesTotal: number;
  topSellers: { productId: string; name: string; emoji: string | null; units: number; revenue: number }[];
  lowStockItems: LowStockItem[];
  outOfStockCount: number;
  restockSuggestions: LowStockItem[];
  deadStock: DeadStockItem[];
  debtors: DebtorInsight[];
  debtorsLocked: boolean;
  totalOwed: number;
  highExpenseCategory: ExpenseFlag | null;
  stockoutForecasts: StockoutForecast[];
  alerts: BusinessAlert[];
  health: BusinessHealth;
  forecast: MonthlyForecast | null;
}

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  salary: 'Salary',
  transport: 'Transport',
  utilities: 'Utilities',
  inventory_purchase: 'Inventory Purchase',
  logistics: 'Logistics',
  miscellaneous: 'Miscellaneous',
};

function startOfDayInTz(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  // Approximates the org's local midnight as a UTC instant — good enough
  // for a "today so far" filter (same tolerance the rest of the app
  // already accepts for date-only fields elsewhere).
  return `${y}-${m}-${d}T00:00:00`;
}

// 0-100, clamped — a thin wrapper so every dimension's scoring formula
// reads the same way rather than repeating Math.max/Math.min everywhere.
function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function useBusinessInsights() {
  const { session } = useAuth();
  const entitlementsQuery = useEntitlements();
  const isPremium = entitlementsQuery.data?.tier === 'premium';

  return useQuery({
    queryKey: ['business-insights', session?.user.id, isPremium],
    queryFn: async (): Promise<BusinessInsights> => {
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', session!.user.id).single();
      if (!profile) throw new Error('No profile');
      const { data: org } = await supabase.from('organizations').select('currency, timezone').eq('id', profile.org_id).single();
      const currency = org?.currency ?? 'USD';
      const timezone = org?.timezone ?? 'UTC';
      const todayStart = startOfDayInTz(timezone);
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        dailyProfitRes,
        salesTodayRes,
        topSellersRes,
        lowStockRes,
        activeProductsRes,
        recentSaleMovementsRes,
        debtorsRes,
        expensesRes,
        kpisRes,
        revenueProfitRes,
      ] = await Promise.all([
        supabase.rpc('get_daily_product_profit'),
        supabase.from('sales').select('total').gte('created_at', todayStart),
        supabase.rpc('get_top_sellers', { p_limit: 5 }),
        supabase
          .from('products')
          .select('id, name, emoji, qty_on_hand, reorder_level, status')
          .in('status', ['low_stock', 'out_of_stock'])
          .is('archived_at', null)
          .order('qty_on_hand', { ascending: true })
          .limit(15),
        // Capped at 300 — plenty for a small/medium catalog; this is a
        // dashboard insight, not an exhaustive inventory export.
        supabase.from('products').select('id, name, emoji, qty_on_hand').is('archived_at', null).eq('is_active', true).limit(300),
        supabase.from('stock_movements').select('product_id').eq('type', 'sale').gte('created_at', monthAgo).limit(2000),
        // RLS-gated to Premium (org_is_premium()) — a Free-tier org simply
        // gets an empty array back here, no error; isPremium (above) is
        // what actually distinguishes "no debtors" from "locked".
        supabase.from('debtors').select('id, customer_name, amount_owed').gt('amount_owed', 0).order('amount_owed', { ascending: false }).limit(5),
        supabase.from('expenses').select('category, amount').gte('incurred_at', monthAgo.slice(0, 10)),
        supabase.rpc('get_kpis'),
        supabase.rpc('get_monthly_revenue_profit'),
      ]);

      const dailyProfit = dailyProfitRes.data ?? [];
      const todaysProfit = dailyProfit.reduce((sum, p) => sum + (Number(p.profit) || 0), 0);

      const salesToday = salesTodayRes.data ?? [];
      const todaysSalesCount = salesToday.length;
      const todaysSalesTotal = salesToday.reduce((sum, s) => sum + Number(s.total), 0);

      const topSellers = (topSellersRes.data ?? []).map((p) => ({
        productId: p.product_id,
        name: p.name,
        emoji: p.emoji,
        units: Number(p.units),
        revenue: Number(p.revenue),
      }));

      const lowStockItems: LowStockItem[] = (lowStockRes.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        qtyOnHand: p.qty_on_hand,
        reorderLevel: p.reorder_level,
        status: p.status as 'low_stock' | 'out_of_stock',
      }));
      const outOfStockCount = lowStockItems.filter((i) => i.status === 'out_of_stock').length;

      // Prioritizes low/out-of-stock items that are also fast movers — a
      // restock suggestion is more useful ranked by "this one's actually
      // selling" than by raw quantity alone.
      const topSellerIds = new Set(topSellers.map((t) => t.productId));
      const restockSuggestions = [...lowStockItems]
        .sort((a, b) => Number(topSellerIds.has(b.id)) - Number(topSellerIds.has(a.id)))
        .slice(0, 5);

      const soldProductIds = new Set((recentSaleMovementsRes.data ?? []).map((m) => m.product_id));
      const deadStock: DeadStockItem[] = (activeProductsRes.data ?? [])
        .filter((p) => !soldProductIds.has(p.id))
        .slice(0, 8)
        .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, qtyOnHand: p.qty_on_hand }));

      const debtorRows = debtorsRes.data ?? [];
      const debtors: DebtorInsight[] = debtorRows.map((d) => ({ id: d.id, customerName: d.customer_name, amountOwed: Number(d.amount_owed) }));
      const totalOwed = debtors.reduce((sum, d) => sum + d.amountOwed, 0);

      const expenseTotals = new Map<ExpenseCategory, number>();
      let expenseGrandTotal = 0;
      for (const row of expensesRes.data ?? []) {
        const amount = Number(row.amount);
        expenseTotals.set(row.category, (expenseTotals.get(row.category) ?? 0) + amount);
        expenseGrandTotal += amount;
      }
      let highExpenseCategory: ExpenseFlag | null = null;
      for (const [category, amount] of expenseTotals) {
        const pct = expenseGrandTotal > 0 ? Math.round((amount / expenseGrandTotal) * 100) : 0;
        if (pct >= 40 && (!highExpenseCategory || amount > highExpenseCategory.amount)) {
          highExpenseCategory = { category, label: CATEGORY_LABEL[category], amount, pct };
        }
      }

      // Sell-through estimate from the same 30-day window get_top_sellers
      // already computed (units sold / 30 = avg daily rate), paired with
      // each product's live qty_on_hand — simple division, not a model.
      const qtyByProduct = new Map((activeProductsRes.data ?? []).map((p) => [p.id, p.qty_on_hand]));
      const stockoutForecasts: StockoutForecast[] = topSellers
        .map((t) => {
          const qty = qtyByProduct.get(t.productId);
          const dailyRate = t.units / 30;
          if (qty === undefined || dailyRate <= 0) return null;
          return { productId: t.productId, name: t.name, emoji: t.emoji, daysLeft: Math.round(qty / dailyRate) };
        })
        .filter((f): f is StockoutForecast => f !== null && f.daysLeft <= 30)
        .sort((a, b) => a.daysLeft - b.daysLeft);

      // ---- Proactive alerts (Dashboard-surfaced, most urgent first) ----
      const alerts: BusinessAlert[] = [];
      const imminentStockouts = stockoutForecasts.filter((f) => f.daysLeft <= 7);
      if (imminentStockouts.length > 0) {
        alerts.push({
          id: 'imminent-stockout',
          severity: 'critical',
          icon: '⏳',
          message:
            imminentStockouts.length === 1
              ? `${imminentStockouts[0].name} will run out in ~${imminentStockouts[0].daysLeft} day${imminentStockouts[0].daysLeft === 1 ? '' : 's'}.`
              : `${imminentStockouts.length} products will run out of stock within a week.`,
        });
      }
      if (outOfStockCount > 0) {
        alerts.push({
          id: 'out-of-stock',
          severity: 'critical',
          icon: '⛔',
          message: `${outOfStockCount} product${outOfStockCount === 1 ? ' is' : 's are'} completely out of stock right now.`,
        });
      }
      if (highExpenseCategory) {
        alerts.push({
          id: 'high-expense',
          severity: 'warning',
          icon: '⚠️',
          message: `${highExpenseCategory.label} is ${highExpenseCategory.pct}% of your last 30 days of expenses.`,
        });
      }
      if (deadStock.length > 0) {
        alerts.push({
          id: 'dead-stock',
          severity: 'warning',
          icon: '😴',
          message: `${deadStock.length} product${deadStock.length === 1 ? " hasn't" : "s haven't"} sold in 30 days.`,
        });
      }
      if (!isPremium || debtors.length === 0) {
        // no debt alert for locked/empty state
      } else if (totalOwed > 0) {
        alerts.push({
          id: 'debtors',
          severity: 'info',
          icon: '💸',
          message: `Customers owe you ${totalOwed.toLocaleString()} ${currency} in total.`,
        });
      }

      // ---- Business Health Score ----
      // Only scores dimensions with real underlying data — no placeholder
      // numbers for things this app doesn't track (employee productivity,
      // supplier reliability, stock-count accuracy, branch comparison).
      const kpis = kpisRes.data as DashboardKpis | null;
      const dimensions: HealthDimension[] = [];

      const totalProducts = kpis?.total_products ?? activeProductsRes.data?.length ?? 0;
      if (totalProducts > 0) {
        const problemPct = ((lowStockItems.length + deadStock.length) / totalProducts) * 100;
        const inventoryScore = clampScore(100 - problemPct * 1.5);
        dimensions.push({
          label: 'Inventory health',
          score: inventoryScore,
          insight:
            inventoryScore >= 80
              ? 'Stock levels and turnover look healthy.'
              : `${lowStockItems.length} low/out-of-stock and ${deadStock.length} dead-stock items are dragging this down.`,
        });
      } else {
        dimensions.push({ label: 'Inventory health', score: null, insight: 'Add products to score this.' });
      }

      if (kpis && kpis.monthly_profit !== null) {
        const margin = kpis.today_revenue > 0 ? (todaysProfit / Math.max(kpis.today_revenue, 1)) * 100 : 0;
        const profitScore = clampScore(kpis.monthly_profit > 0 ? 55 + margin : 30 + margin);
        dimensions.push({
          label: 'Profitability',
          score: profitScore,
          insight: kpis.monthly_profit > 0 ? 'Profitable this month.' : 'Running at a loss this month — check pricing and expenses.',
        });
      } else {
        dimensions.push({ label: 'Profitability', score: null, insight: 'Record more sales to score this.' });
      }

      if (kpis && kpis.prior_monthly_profit !== null && kpis.prior_monthly_profit !== 0) {
        const growthPct = ((kpis.monthly_profit ?? 0) - kpis.prior_monthly_profit) / Math.abs(kpis.prior_monthly_profit) * 100;
        const growthScore = clampScore(50 + growthPct);
        dimensions.push({
          label: 'Sales growth',
          score: growthScore,
          insight: growthPct >= 0 ? `Profit is up ${Math.round(growthPct)}% vs last month.` : `Profit is down ${Math.round(Math.abs(growthPct))}% vs last month.`,
        });
      } else {
        dimensions.push({ label: 'Sales growth', score: null, insight: 'Needs at least two months of history to score.' });
      }

      if (isPremium) {
        const monthlyRevenue = kpis?.monthly_profit !== null && kpis ? kpis.today_revenue * 30 : 0;
        const debtScore = monthlyRevenue > 0 ? clampScore(100 - (totalOwed / monthlyRevenue) * 100) : totalOwed === 0 ? 100 : 60;
        dimensions.push({
          label: 'Cash flow (debt)',
          score: debtScore,
          insight: totalOwed === 0 ? 'No outstanding customer debt.' : `${totalOwed.toLocaleString()} ${currency} owed by customers.`,
        });
      } else {
        dimensions.push({ label: 'Cash flow (debt)', score: null, insight: 'Upgrade to Premium to track customer debt.' });
      }

      const scored = dimensions.filter((d): d is HealthDimension & { score: number } => d.score !== null);
      const overall = scored.length > 0 ? clampScore(scored.reduce((sum, d) => sum + d.score, 0) / scored.length) : 0;

      // ---- Simple next-month forecast (linear trend, not a real model) ----
      const revenueProfitRows = (revenueProfitRes.data ?? []) as MonthlyRevenueProfitRow[];
      const sortedMonths = [...revenueProfitRows].sort((a, b) => (a.month < b.month ? -1 : 1));
      let forecast: MonthlyForecast | null = null;
      if (sortedMonths.length >= 2) {
        const recent = sortedMonths.slice(-3);
        const growthRates: number[] = [];
        for (let i = 1; i < recent.length; i++) {
          const prevRevenue = Number(recent[i - 1].revenue);
          if (prevRevenue > 0) growthRates.push((Number(recent[i].revenue) - prevRevenue) / prevRevenue);
        }
        const avgGrowth = growthRates.length > 0 ? growthRates.reduce((s, g) => s + g, 0) / growthRates.length : 0;
        const last = recent[recent.length - 1];
        forecast = {
          revenue: Math.max(0, Number(last.revenue) * (1 + avgGrowth)),
          profit: Math.max(0, Number(last.profit) * (1 + avgGrowth)),
          confidence: sortedMonths.length >= 6 ? 'high' : sortedMonths.length >= 3 ? 'medium' : 'low',
        };
      }

      return {
        currency,
        timezone,
        todaysProfit,
        todaysSalesCount,
        todaysSalesTotal,
        topSellers,
        lowStockItems,
        outOfStockCount,
        restockSuggestions,
        deadStock,
        debtors,
        debtorsLocked: !isPremium,
        totalOwed,
        highExpenseCategory,
        stockoutForecasts,
        alerts,
        health: { overall, dimensions },
        forecast,
      };
    },
    enabled: !!session && !entitlementsQuery.isLoading,
  });
}
