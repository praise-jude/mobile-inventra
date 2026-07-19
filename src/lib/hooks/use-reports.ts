import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Granularity } from '@/types/database';

// Mirrors Inventra/lib/queries/reports.ts — same RPCs (get_sales_summary,
// get_sales_by_period/branch/product/staff, get_inventory_valuation,
// get_profit_loss), called directly since they're plain read-only
// `language sql stable` functions with no secret-key dependency, same as
// the dashboard's get_kpis/get_top_sellers/get_stock_health already are.

export interface SalesSummary {
  revenue: number;
  discount: number;
  tax: number;
  salesCount: number;
  profit: number;
}

export interface SalesPeriodRow {
  period: string;
  revenue: number;
  salesCount: number;
  profit: number;
}

export interface SalesByBranchRow {
  warehouseId: string;
  warehouseName: string;
  revenue: number;
  salesCount: number;
}

export interface SalesByProductRow {
  productId: string;
  name: string;
  sku: string;
  units: number;
  revenue: number;
  profit: number;
}

export interface SalesByStaffRow {
  staffId: string | null;
  staffName: string;
  revenue: number;
  salesCount: number;
}

export interface InventoryValuationRow {
  productId: string;
  name: string;
  sku: string;
  warehouseId: string | null;
  warehouseName: string | null;
  qtyOnHand: number;
  costPrice: number;
  sellPrice: number;
  inventoryValue: number;
  expectedProfit: number;
}

export interface ProfitLoss {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  marginPct: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export function useSalesReport(range: DateRange, granularity: Granularity, warehouseId?: string) {
  return useQuery({
    queryKey: ['sales-report', range, granularity, warehouseId],
    queryFn: async () => {
      const [summaryRes, periodRes, branchRes, productRes, staffRes] = await Promise.all([
        supabase.rpc('get_sales_summary', { p_from: range.from, p_to: range.to, p_warehouse_id: warehouseId ?? null }),
        supabase.rpc('get_sales_by_period', {
          p_from: range.from,
          p_to: range.to,
          p_granularity: granularity,
          p_warehouse_id: warehouseId ?? null,
        }),
        supabase.rpc('get_sales_by_branch', { p_from: range.from, p_to: range.to }),
        supabase.rpc('get_sales_by_product', { p_from: range.from, p_to: range.to, p_warehouse_id: warehouseId ?? null }),
        supabase.rpc('get_sales_by_staff', { p_from: range.from, p_to: range.to, p_warehouse_id: warehouseId ?? null }),
      ]);
      if (summaryRes.error) throw new Error('Could not load the sales summary.');
      if (periodRes.error) throw new Error('Could not load the sales trend.');
      if (branchRes.error) throw new Error('Could not load sales by branch.');
      if (productRes.error) throw new Error('Could not load sales by product.');
      if (staffRes.error) throw new Error('Could not load sales by staff.');

      const summary: SalesSummary = {
        revenue: Number(summaryRes.data.revenue),
        discount: Number(summaryRes.data.discount),
        tax: Number(summaryRes.data.tax),
        salesCount: Number(summaryRes.data.sales_count),
        profit: Number(summaryRes.data.profit),
      };
      const byPeriod: SalesPeriodRow[] = periodRes.data.map((r) => ({
        period: r.period,
        revenue: Number(r.revenue),
        salesCount: Number(r.sales_count),
        profit: Number(r.profit),
      }));
      const byBranch: SalesByBranchRow[] = branchRes.data.map((r) => ({
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        revenue: Number(r.revenue),
        salesCount: Number(r.sales_count),
      }));
      const byProduct: SalesByProductRow[] = productRes.data.map((r) => ({
        productId: r.product_id,
        name: r.name,
        sku: r.sku,
        units: Number(r.units),
        revenue: Number(r.revenue),
        profit: Number(r.profit),
      }));
      const byStaff: SalesByStaffRow[] = staffRes.data.map((r) => ({
        staffId: r.staff_id,
        staffName: r.staff_name,
        revenue: Number(r.revenue),
        salesCount: Number(r.sales_count),
      }));

      return { summary, byPeriod, byBranch, byProduct, byStaff };
    },
  });
}

export function useInventoryValuation(warehouseId?: string) {
  return useQuery({
    queryKey: ['inventory-valuation', warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_inventory_valuation', { p_warehouse_id: warehouseId ?? null });
      if (error) throw new Error('Could not load the inventory valuation.');
      const rows: InventoryValuationRow[] = data.map((r) => ({
        productId: r.product_id,
        name: r.name,
        sku: r.sku,
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        qtyOnHand: Number(r.qty_on_hand),
        costPrice: Number(r.cost_price),
        sellPrice: Number(r.sell_price),
        inventoryValue: Number(r.inventory_value),
        expectedProfit: Number(r.expected_profit),
      }));
      return rows;
    },
  });
}

export function useProfitLoss(range: DateRange, warehouseId?: string, productId?: string) {
  return useQuery({
    queryKey: ['profit-loss', range, warehouseId, productId],
    queryFn: async (): Promise<ProfitLoss> => {
      const { data, error } = await supabase.rpc('get_profit_loss', {
        p_from: range.from,
        p_to: range.to,
        p_warehouse_id: warehouseId ?? null,
        p_product_id: productId ?? null,
      });
      if (error) throw new Error('Could not load the profit & loss statement.');
      return {
        revenue: Number(data.revenue),
        cogs: Number(data.cogs),
        grossProfit: Number(data.gross_profit),
        operatingExpenses: Number(data.operating_expenses),
        netProfit: Number(data.net_profit),
        marginPct: Number(data.margin_pct),
      };
    },
  });
}
