import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Category, ProductStatus, Supplier, Warehouse } from '@/types/database';

const PAGE_SIZE = 25;

export interface ProductsFilters {
  search?: string;
  categoryId?: string;
  warehouseId?: string;
  status?: ProductStatus;
  active?: 'active' | 'inactive' | 'all';
}

// Mirrors Inventra/lib/queries/products.ts's getProductsPage — same
// filters/search fields/sort, paged via useInfiniteQuery instead of a
// page-number prop since mobile lists are scroll-to-load.
export function useProducts(filters: ProductsFilters) {
  return useInfiniteQuery({
    queryKey: ['products', filters],
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      const q = filters.search?.trim();
      if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%,brand.ilike.%${q}%`);
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.warehouseId) query = query.eq('warehouse_id', filters.warehouseId);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.active === 'active') query = query.eq('is_active', true);
      if (filters.active === 'inactive') query = query.eq('is_active', false);

      const { data, error, count } = await query.range(from, to);
      if (error) throw new Error('Could not load products.');
      return { rows: data ?? [], total: count ?? 0, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), suppliers(name), warehouses(name)')
        .eq('id', id!)
        .single();
      if (error) throw new Error('Could not load this product.');
      return data as typeof data & {
        categories: { name: string } | null;
        suppliers: { name: string } | null;
        warehouses: { name: string } | null;
      };
    },
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw new Error('Could not load categories.');
      return (data ?? []) as Category[];
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw new Error('Could not load suppliers.');
      return (data ?? []) as Supplier[];
    },
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('warehouses').select('*').order('name');
      if (error) throw new Error('Could not load warehouses.');
      return (data ?? []) as Warehouse[];
    },
  });
}
