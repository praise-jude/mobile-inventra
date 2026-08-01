import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { SupplyStatus } from '@/types/database';

const PAGE_SIZE = 25;

export interface SupplyRecordRow {
  id: string;
  referenceNumber: string;
  supplierName: string;
  invoiceNumber: string | null;
  warehouseName: string | null;
  dateSupplied: string;
  status: SupplyStatus;
  totalQuantity: number;
  totalAmount: number;
}

export interface SupplySummary {
  totalSupplies: number;
  totalAmount: number;
  todaysSupplies: number;
  thisWeekSupplies: number;
  thisMonthSupplies: number;
  totalQuantityReceived: number;
  topSupplier: { name: string; totalAmount: number } | null;
}

// Mirrors Inventra/lib/queries/supply-records.ts's getSupplySummary — a
// lightweight aggregate scan (not the full paginated row shape) so the
// summary cards reflect the whole dataset, same split as use-debtors.ts/
// use-invoices.ts's *Totals hooks.
export function useSupplyTotals() {
  return useQuery({
    queryKey: ['supply-records-totals'],
    queryFn: async (): Promise<SupplySummary> => {
      const { data, error } = await supabase
        .from('supply_records')
        .select('supplier_name, total_amount, total_quantity, date_supplied, created_at')
        .is('deleted_at', null)
        .neq('status', 'cancelled');
      if (error) throw new Error('Could not load supply records.');

      const rows = data ?? [];
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let totalAmount = 0;
      let totalQuantityReceived = 0;
      let todaysSupplies = 0;
      let thisWeekSupplies = 0;
      let thisMonthSupplies = 0;
      const bySupplier = new Map<string, number>();

      for (const r of rows) {
        totalAmount += Number(r.total_amount);
        totalQuantityReceived += Number(r.total_quantity);
        bySupplier.set(r.supplier_name, (bySupplier.get(r.supplier_name) ?? 0) + Number(r.total_amount));
        if (r.date_supplied === todayKey) todaysSupplies++;
        const created = new Date(r.created_at);
        if (created >= weekAgo) thisWeekSupplies++;
        if (created >= monthAgo) thisMonthSupplies++;
      }

      let topSupplier: SupplySummary['topSupplier'] = null;
      for (const [name, amount] of bySupplier) {
        if (!topSupplier || amount > topSupplier.totalAmount) topSupplier = { name, totalAmount: amount };
      }

      return { totalSupplies: rows.length, totalAmount, todaysSupplies, thisWeekSupplies, thisMonthSupplies, totalQuantityReceived, topSupplier };
    },
  });
}

export interface SupplyRecordsListFilters {
  search?: string;
  status?: SupplyStatus;
  warehouseId?: string;
}

export function useSupplyRecordsList(filters: SupplyRecordsListFilters) {
  return useInfiniteQuery({
    queryKey: ['supply-records-list', filters],
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('supply_records')
        .select('id, reference_number, supplier_name, invoice_number, date_supplied, status, total_quantity, total_amount, warehouses(name)', {
          count: 'exact',
        })
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (filters.search?.trim()) {
        const q = filters.search.trim().replace(/[%,]/g, '');
        query = query.or(`supplier_name.ilike.%${q}%,invoice_number.ilike.%${q}%,reference_number.ilike.%${q}%`);
      }
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.warehouseId) query = query.eq('warehouse_id', filters.warehouseId);

      const { data, error, count } = await query.range(from, to);
      if (error) throw new Error('Could not load supply records.');

      const rows: SupplyRecordRow[] = (data ?? []).map((r) => ({
        id: r.id,
        referenceNumber: r.reference_number,
        supplierName: r.supplier_name,
        invoiceNumber: r.invoice_number,
        warehouseName: (r.warehouses as unknown as { name: string } | null)?.name ?? null,
        dateSupplied: r.date_supplied,
        status: r.status,
        totalQuantity: Number(r.total_quantity),
        totalAmount: Number(r.total_amount),
      }));
      return { rows, total: count ?? 0, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}

export interface SupplyRecordItemRow {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface SupplyRecordDetail {
  id: string;
  referenceNumber: string;
  supplierId: string | null;
  supplierName: string;
  supplierPhone: string | null;
  supplierEmail: string | null;
  invoiceNumber: string | null;
  warehouseId: string;
  warehouseName: string | null;
  dateSupplied: string;
  status: SupplyStatus;
  totalQuantity: number;
  totalAmount: number;
  notes: string | null;
  createdByName: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  items: SupplyRecordItemRow[];
}

export function useSupplyRecordDetail(id: string | null) {
  return useQuery({
    queryKey: ['supply-record-detail', id],
    queryFn: async (): Promise<SupplyRecordDetail> => {
      const { data: record, error } = await supabase
        .from('supply_records')
        .select(
          `id, reference_number, supplier_id, supplier_name, supplier_phone, supplier_email, invoice_number,
           warehouse_id, date_supplied, status, total_quantity, total_amount, notes,
           verified_at, cancelled_at,
           warehouses(name),
           created_by_profile:profiles!supply_records_created_by_fkey(first_name, last_name),
           verified_by_profile:profiles!supply_records_verified_by_fkey(first_name, last_name),
           cancelled_by_profile:profiles!supply_records_cancelled_by_fkey(first_name, last_name)`,
        )
        .eq('id', id!)
        .is('deleted_at', null)
        .single();
      if (error || !record) throw new Error('Could not load this supply record.');

      const { data: items, error: itemsError } = await supabase
        .from('supply_record_items')
        .select('id, product_id, quantity, unit_cost, line_total, products(name)')
        .eq('supply_record_id', id!);
      if (itemsError) throw new Error("Could not load this supply's product lines.");

      type ProfileRef = { first_name: string; last_name: string } | null;
      const createdBy = record.created_by_profile as unknown as ProfileRef;
      const verifiedBy = record.verified_by_profile as unknown as ProfileRef;
      const cancelledBy = record.cancelled_by_profile as unknown as ProfileRef;

      return {
        id: record.id,
        referenceNumber: record.reference_number,
        supplierId: record.supplier_id,
        supplierName: record.supplier_name,
        supplierPhone: record.supplier_phone,
        supplierEmail: record.supplier_email,
        invoiceNumber: record.invoice_number,
        warehouseId: record.warehouse_id,
        warehouseName: (record.warehouses as unknown as { name: string } | null)?.name ?? null,
        dateSupplied: record.date_supplied,
        status: record.status,
        totalQuantity: Number(record.total_quantity),
        totalAmount: Number(record.total_amount),
        notes: record.notes,
        createdByName: createdBy ? `${createdBy.first_name} ${createdBy.last_name}` : null,
        verifiedByName: verifiedBy ? `${verifiedBy.first_name} ${verifiedBy.last_name}` : null,
        verifiedAt: record.verified_at,
        cancelledByName: cancelledBy ? `${cancelledBy.first_name} ${cancelledBy.last_name}` : null,
        cancelledAt: record.cancelled_at,
        items: (items ?? []).map((i) => ({
          id: i.id,
          productId: i.product_id,
          productName: (i.products as unknown as { name: string } | null)?.name ?? '—',
          quantity: Number(i.quantity),
          unitCost: Number(i.unit_cost),
          lineTotal: Number(i.line_total),
        })),
      };
    },
    enabled: !!id,
  });
}
