import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Category, ProductStatus, Supplier, Warehouse } from '@/types/database';

const PAGE_SIZE = 25;

export interface ProductsFilters {
  search?: string;
  categoryId?: string;
  warehouseId?: string;
  supplierId?: string;
  status?: ProductStatus;
  active?: 'active' | 'inactive' | 'all';
  minPrice?: number;
  maxPrice?: number;
  minMarginPct?: number;
  maxMarginPct?: number;
  expiryFrom?: string;
  expiryTo?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface ProductSearchRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  emoji: string | null;
  image_url: string | null;
  sell_price: number;
  qty_on_hand: number;
  status: ProductStatus;
  is_active: boolean;
  warehouse_id: string | null;
  category_name: string | null;
}

// Mirrors Inventra/lib/queries/products.ts's getProductsPage — both now
// call the same search_products() RPC (typo-tolerant pg_trgm ranking
// across name/sku/barcode/brand/description/supplier name, plus price/
// margin/expiry/date-added range filters), paged via useInfiniteQuery
// instead of a page-number prop since mobile lists are scroll-to-load.
export function useProducts(filters: ProductsFilters) {
  return useInfiniteQuery({
    queryKey: ['products', filters],
    queryFn: async ({ pageParam }) => {
      const offset = pageParam * PAGE_SIZE;

      const { data, error } = await supabase.rpc('search_products', {
        p_search: filters.search?.trim() || null,
        p_category_id: filters.categoryId || null,
        p_warehouse_id: filters.warehouseId || null,
        p_supplier_id: filters.supplierId || null,
        p_status: filters.status || null,
        p_active: filters.active === 'active' ? true : filters.active === 'inactive' ? false : null,
        p_min_price: filters.minPrice ?? null,
        p_max_price: filters.maxPrice ?? null,
        p_min_margin_pct: filters.minMarginPct ?? null,
        p_max_margin_pct: filters.maxMarginPct ?? null,
        p_expiry_from: filters.expiryFrom || null,
        p_expiry_to: filters.expiryTo || null,
        p_created_from: filters.createdFrom || null,
        p_created_to: filters.createdTo || null,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (error) throw new Error('Could not load products.');
      const rows = (data ?? []) as (ProductSearchRow & { total_count: number })[];
      return { rows, total: rows[0]?.total_count ?? 0, page: pageParam };
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
