import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { useEntitlements } from '@/lib/hooks/use-entitlements';
import { supabase } from '@/lib/supabase';
import type { ExpenseCategory } from '@/types/database';

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
      };
    },
    enabled: !!session && !entitlementsQuery.isLoading,
  });
}
