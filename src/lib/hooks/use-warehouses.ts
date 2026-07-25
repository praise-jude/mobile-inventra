import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { WarehouseStatus } from '@/types/database';

export interface WarehouseOverviewRow {
  id: string;
  name: string;
  address: string | null;
  country: string | null;
  state: string | null;
  phone: string | null;
  status: WarehouseStatus;
  managerProfileId: string | null;
  managerName: string | null;
  capacity: number | null;
  skuCount: number;
  stockValue: number;
  utilizationPct: number;
}

interface StockSummaryRow {
  warehouse_id: string;
  sku_count: number;
  stock_value: number;
  total_units: number;
}

// Mirrors Inventra/lib/queries/inventory.ts's getWarehousesOverview — same
// get_warehouse_stock_summary() RPC, same explicit FK hint (profiles has two
// FKs to/from warehouses: manager_profile_id and profiles.branch_id).
export function useWarehousesOverview() {
  return useQuery({
    queryKey: ['warehouses-overview'],
    queryFn: async (): Promise<WarehouseOverviewRow[]> => {
      const [{ data: warehouses, error: whError }, { data: summary, error: summaryError }] = await Promise.all([
        supabase
          .from('warehouses')
          .select('id, name, address, country, state, phone, status, capacity, manager_profile_id, profiles!warehouses_manager_profile_id_fkey(first_name, last_name)')
          .order('name'),
        supabase.rpc('get_warehouse_stock_summary'),
      ]);
      if (whError) throw new Error('Could not load branches.');
      if (summaryError) throw new Error('Could not load branches.');

      const summaryById = new Map(((summary ?? []) as StockSummaryRow[]).map((s) => [s.warehouse_id, s]));

      return (warehouses ?? []).map((w) => {
        const s = summaryById.get(w.id);
        const totalUnits = s?.total_units ?? 0;
        const manager = w.profiles as unknown as { first_name: string; last_name: string } | null;
        return {
          id: w.id,
          name: w.name,
          address: w.address,
          country: w.country,
          state: w.state,
          phone: w.phone,
          status: w.status as WarehouseStatus,
          managerProfileId: w.manager_profile_id,
          managerName: manager ? `${manager.first_name} ${manager.last_name}` : null,
          capacity: w.capacity,
          skuCount: s?.sku_count ?? 0,
          stockValue: Number(s?.stock_value ?? 0),
          utilizationPct: w.capacity ? Math.min(100, Math.round((totalUnits / w.capacity) * 100)) : 0,
        };
      });
    },
  });
}

export interface WarehouseProductOption {
  id: string;
  name: string;
  sku: string;
  qtyOnHand: number;
}

// Mirrors Inventra/lib/queries/inventory.ts's getProductsInWarehouse — used
// by the transfer-stock flow on the branch detail screen.
export function useProductsInWarehouse(warehouseId: string | null) {
  return useQuery({
    queryKey: ['products-in-warehouse', warehouseId],
    queryFn: async (): Promise<WarehouseProductOption[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, qty_on_hand')
        .eq('warehouse_id', warehouseId!)
        .is('archived_at', null)
        .order('name');
      if (error) throw new Error("Could not load this branch's products.");
      return (data ?? []).map((p) => ({ id: p.id, name: p.name, sku: p.sku, qtyOnHand: p.qty_on_hand }));
    },
    enabled: !!warehouseId,
  });
}
