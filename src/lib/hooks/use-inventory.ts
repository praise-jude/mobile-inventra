import { useInfiniteQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { MovementType } from '@/types/database';

const PAGE_SIZE = 30;

export interface MovementRow {
  id: string;
  type: MovementType;
  qty_delta: number;
  reason: string | null;
  adjustment_type: string | null;
  notes: string | null;
  created_at: string;
  product_name: string;
  actor_name: string | null;
}

// Mirrors Inventra/lib/queries/inventory.ts's getStockMovements — every
// movement type. `adjustmentsOnly` narrows it to `type in
// (adjustment, expired)`, matching web's separate Adjustments log tab.
export function useStockMovements(opts: { adjustmentsOnly?: boolean; productId?: string } = {}) {
  return useInfiniteQuery({
    queryKey: ['stock-movements', opts],
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('stock_movements')
        .select('id, type, qty_delta, reason, adjustment_type, notes, created_at, products(name), profiles(first_name, last_name)', {
          count: 'exact',
        })
        .order('created_at', { ascending: false });
      if (opts.adjustmentsOnly) query = query.in('type', ['adjustment', 'expired']);
      if (opts.productId) query = query.eq('product_id', opts.productId);

      const { data, error, count } = await query.range(from, to);
      if (error) throw new Error('Could not load stock movements.');

      const rows: MovementRow[] = (data ?? []).map((m) => {
        const product = m.products as unknown as { name: string } | null;
        const actor = m.profiles as unknown as { first_name: string; last_name: string } | null;
        return {
          id: m.id,
          type: m.type,
          qty_delta: m.qty_delta,
          reason: m.reason,
          adjustment_type: m.adjustment_type,
          notes: m.notes,
          created_at: m.created_at,
          product_name: product?.name ?? '—',
          actor_name: actor ? `${actor.first_name} ${actor.last_name}` : null,
        };
      });
      return { rows, total: count ?? 0, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}
