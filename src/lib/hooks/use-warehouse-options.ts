import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface WarehouseOption {
  id: string;
  name: string;
}

// Mirrors Inventra/lib/queries/products.ts's getWarehouseOptions — a
// lightweight id/name list for pickers, distinct from
// use-warehouses.ts's useWarehousesOverview (which also pulls stock
// summary RPCs the Cash Register branch selector doesn't need).
export function useWarehouseOptions() {
  return useQuery({
    queryKey: ['warehouse-options'],
    queryFn: async (): Promise<WarehouseOption[]> => {
      const { data, error } = await supabase.from('warehouses').select('id, name').eq('status', 'active').order('name');
      if (error) throw new Error('Could not load branches.');
      return data ?? [];
    },
  });
}
