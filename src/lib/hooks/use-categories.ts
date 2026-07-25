import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface CategoryDetailRow {
  id: string;
  name: string;
  emoji: string | null;
  productCount: number;
}

interface ProductCountRow {
  category_id: string;
  count: number;
}

// Mirrors Inventra/lib/queries/categories.ts's getCategoriesDetailed — same
// get_category_product_counts() RPC as web, so counts always match.
export function useCategoriesDetailed() {
  return useQuery({
    queryKey: ['categories-detailed'],
    queryFn: async (): Promise<CategoryDetailRow[]> => {
      const [{ data: categories, error: catError }, { data: counts, error: countError }] = await Promise.all([
        supabase.from('categories').select('id, name, emoji').order('name'),
        supabase.rpc('get_category_product_counts'),
      ]);
      if (catError) throw new Error('Could not load categories.');
      if (countError) throw new Error('Could not load categories.');

      const countByCategory = new Map(((counts ?? []) as ProductCountRow[]).map((c) => [c.category_id, c.count]));
      return (categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        productCount: countByCategory.get(c.id) ?? 0,
      }));
    },
  });
}
