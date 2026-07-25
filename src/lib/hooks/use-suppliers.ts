import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface SupplierDetailRow {
  id: string;
  name: string;
  company: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  productCount: number;
}

interface ProductCountRow {
  supplier_id: string;
  count: number;
}

// Mirrors Inventra/lib/queries/suppliers.ts's getSuppliersDetailed.
export function useSuppliersDetailed() {
  return useQuery({
    queryKey: ['suppliers-detailed'],
    queryFn: async (): Promise<SupplierDetailRow[]> => {
      const [{ data: suppliers, error: supError }, { data: counts, error: countError }] = await Promise.all([
        supabase.from('suppliers').select('id, name, company, contact_person, email, phone, address').order('name'),
        supabase.rpc('get_supplier_product_counts'),
      ]);
      if (supError) throw new Error('Could not load suppliers.');
      if (countError) throw new Error('Could not load suppliers.');

      const countBySupplier = new Map(((counts ?? []) as ProductCountRow[]).map((c) => [c.supplier_id, c.count]));
      return (suppliers ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        company: s.company,
        contactPerson: s.contact_person,
        email: s.email,
        phone: s.phone,
        address: s.address,
        productCount: countBySupplier.get(s.id) ?? 0,
      }));
    },
  });
}

export interface SupplierPurchase {
  id: string;
  productName: string;
  qty: number;
  amount: number;
  createdAt: string;
}

export interface SupplierDetail extends SupplierDetailRow {
  products: { id: string; name: string; sku: string; emoji: string | null }[];
  purchases: SupplierPurchase[];
  totalPurchases: number;
}

// Mirrors Inventra/lib/queries/suppliers.ts's getSupplierDetail.
export function useSupplierDetail(id: string | null) {
  return useQuery({
    queryKey: ['supplier-detail', id],
    queryFn: async (): Promise<SupplierDetail> => {
      const { data: supplier, error: supError } = await supabase
        .from('suppliers')
        .select('id, name, company, contact_person, email, phone, address')
        .eq('id', id!)
        .single();
      if (supError || !supplier) throw new Error('Could not load this supplier.');

      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name, sku, emoji, cost_price')
        .eq('supplier_id', id!)
        .is('archived_at', null);
      if (prodError) throw new Error("Could not load this supplier's products.");

      const productIds = (products ?? []).map((p) => p.id);
      const costById = new Map((products ?? []).map((p) => [p.id, Number(p.cost_price)]));

      let purchases: SupplierPurchase[] = [];
      if (productIds.length > 0) {
        const { data: movements, error: movError } = await supabase
          .from('stock_movements')
          .select('id, product_id, qty_delta, unit_price, created_at, products(name)')
          .eq('type', 'received')
          .in('product_id', productIds)
          .order('created_at', { ascending: false })
          .limit(25);
        if (movError) throw new Error("Could not load this supplier's purchase history.");

        purchases = (movements ?? []).map((m) => {
          const unitPrice = m.unit_price !== null ? Number(m.unit_price) : (costById.get(m.product_id) ?? 0);
          return {
            id: m.id,
            productName: (m.products as unknown as { name: string } | null)?.name ?? '—',
            qty: m.qty_delta,
            amount: m.qty_delta * unitPrice,
            createdAt: m.created_at,
          };
        });
      }

      return {
        id: supplier.id,
        name: supplier.name,
        company: supplier.company,
        contactPerson: supplier.contact_person,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        productCount: products?.length ?? 0,
        products: (products ?? []).map((p) => ({ id: p.id, name: p.name, sku: p.sku, emoji: p.emoji })),
        purchases,
        totalPurchases: purchases.reduce((sum, p) => sum + p.amount, 0),
      };
    },
    enabled: !!id,
  });
}
