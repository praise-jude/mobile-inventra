import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { PaymentMethod } from '@/types/database';

const PAGE_SIZE = 20;

export interface SalesFilters {
  search?: string;
  warehouseId?: string;
}

export interface SaleListRow {
  id: string;
  customerName: string;
  total: number;
  createdAt: string;
  warehouseName: string | null;
}

// Mirrors Inventra/lib/queries/sales.ts's getSalesPage, simplified to a
// single ilike over the linked customer's name (mobile's recordSale never
// sets walk_in_name, unlike web's older data, so there's no walk-in branch
// to match here).
export function useSales(filters: SalesFilters) {
  return useInfiniteQuery({
    queryKey: ['sales', filters],
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('sales')
        .select('id, walk_in_name, total, created_at, warehouse_id, customers(name), warehouses(name)', {
          count: 'exact',
        })
        .order('created_at', { ascending: false });
      if (filters.warehouseId) query = query.eq('warehouse_id', filters.warehouseId);

      const { data, error, count } = await query.range(from, to);
      if (error) throw new Error('Could not load sales.');

      const q = filters.search?.trim().toLowerCase();
      let rows = (data ?? []) as unknown as {
        id: string;
        walk_in_name: string | null;
        total: number;
        created_at: string;
        customers: { name: string } | null;
        warehouses: { name: string } | null;
      }[];
      if (q) {
        rows = rows.filter((r) => (r.customers?.name ?? r.walk_in_name ?? 'walk-in customer').toLowerCase().includes(q));
      }

      const mapped: SaleListRow[] = rows.map((r) => ({
        id: r.id,
        customerName: r.customers?.name ?? r.walk_in_name ?? 'Walk-in customer',
        total: Number(r.total),
        createdAt: r.created_at,
        warehouseName: r.warehouses?.name ?? null,
      }));
      return { rows: mapped, total: count ?? 0, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}

export interface SaleDetailItem {
  id: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SaleDetail {
  id: string;
  receiptNumber: string;
  customerName: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  createdAt: string;
  items: SaleDetailItem[];
  payments: { method: PaymentMethod; amount: number }[];
  orgName: string;
  currency: string;
  branchName: string | null;
  branchAddress: string | null;
  cashierName: string | null;
  receiptFooter: string | null;
}

export function useSaleDetail(id: string | null) {
  return useQuery({
    queryKey: ['sale-detail', id],
    queryFn: async (): Promise<SaleDetail> => {
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select(
          'id, org_id, customer_id, walk_in_name, warehouse_id, subtotal, discount_amount, tax_amount, total, notes, created_at, customers(name), warehouses(name, address), profiles(first_name, last_name)',
        )
        .eq('id', id!)
        .single();
      if (saleError || !sale) throw new Error('Could not load this sale.');

      const [{ data: items, error: itemError }, { data: payments, error: payError }, { data: org }, { data: printSettings }] =
        await Promise.all([
          supabase.from('stock_movements').select('id, qty_delta, unit_price, products(name)').eq('sale_id', id!),
          supabase.from('sale_payments').select('method, amount').eq('sale_id', id!),
          supabase.from('organizations').select('name, currency').eq('id', sale.org_id).single(),
          supabase.from('print_settings').select('receipt_footer').eq('org_id', sale.org_id).maybeSingle(),
        ]);
      if (itemError) throw new Error("Could not load this sale's line items.");
      if (payError) throw new Error("Could not load this sale's payments.");

      const warehouse = sale.warehouses as unknown as { name: string; address: string | null } | null;
      const cashier = sale.profiles as unknown as { first_name: string; last_name: string } | null;

      return {
        id: sale.id,
        receiptNumber: `RCPT-${sale.id.slice(0, 8).toUpperCase()}`,
        customerName: (sale.customers as unknown as { name: string } | null)?.name ?? sale.walk_in_name ?? 'Walk-in customer',
        subtotal: Number(sale.subtotal),
        discountAmount: Number(sale.discount_amount),
        taxAmount: Number(sale.tax_amount),
        total: Number(sale.total),
        notes: sale.notes,
        createdAt: sale.created_at,
        items: (items ?? []).map((i) => {
          const qty = Math.abs(i.qty_delta);
          const unitPrice = Number(i.unit_price ?? 0);
          return {
            id: i.id,
            productName: (i.products as unknown as { name: string } | null)?.name ?? '—',
            qty,
            unitPrice,
            lineTotal: qty * unitPrice,
          };
        }),
        payments: (payments ?? []).map((p) => ({ method: p.method, amount: Number(p.amount) })),
        orgName: org?.name ?? '',
        currency: org?.currency ?? 'USD',
        branchName: warehouse?.name ?? null,
        branchAddress: warehouse?.address ?? null,
        cashierName: cashier ? `${cashier.first_name} ${cashier.last_name}` : null,
        receiptFooter: printSettings?.receipt_footer ?? null,
      };
    },
    enabled: !!id,
  });
}
