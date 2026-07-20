import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { SelectField } from '@/components/ui/select-field';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useOrgCurrency } from '@/lib/hooks/use-org-currency';
import { useCategories, useProducts, useSuppliers, useWarehouses } from '@/lib/hooks/use-products';
import { parseSmartQuery } from '@/lib/smart-query';
import type { ProductStatus } from '@/types/database';

const STATUS_META: Record<ProductStatus, { label: string; badgeClass: string; textClass: string }> = {
  in_stock: {
    label: 'in stock',
    badgeClass: 'bg-green-weak dark:bg-green-weak-dark',
    textClass: 'text-green dark:text-green-dark',
  },
  low_stock: {
    label: 'low stock',
    badgeClass: 'bg-amber-weak dark:bg-amber-weak-dark',
    textClass: 'text-amber dark:text-amber-dark',
  },
  out_of_stock: {
    label: 'out of stock',
    badgeClass: 'bg-red-weak dark:bg-red-weak-dark',
    textClass: 'text-red dark:text-red-dark',
  },
};

const STATUS_FILTERS: { key: ProductStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_stock', label: 'In stock' },
  { key: 'low_stock', label: 'Low stock' },
  { key: 'out_of_stock', label: 'Out of stock' },
];

// Mirrors Inventra/components/products/ProductsClient.tsx, trimmed to
// mobile's single-column list — search + status filter + infinite scroll,
// with Adjustments/Movements as quick links rather than separate tabs
// (Inventra/components/inventory/InventoryTabs.tsx's sub-nav, flattened).
export default function InventoryScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minMargin, setMinMargin] = useState('');
  const [maxMargin, setMaxMargin] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const currency = useOrgCurrency();

  const categoriesQuery = useCategories();
  const warehousesQuery = useWarehouses();
  const suppliersQuery = useSuppliers();

  // A handful of common phrases ("low stock", "above 50000", "expired
  // items"...) map straight to an existing filter instead of being
  // searched for as literal text — see lib/smart-query.ts for the fixed
  // pattern list this recognizes. Derived from the debounced search text
  // rather than copied into its own state (no effect/setState needed):
  // each pattern overlays exactly one filter on top of whatever the manual
  // controls below already have, and the matched phrase stays visible in
  // the search box rather than being cleared out from under the user.
  const smartQuery = useMemo(() => parseSmartQuery(debouncedSearch), [debouncedSearch]);

  const advancedFiltersActive = !!categoryId || !!warehouseId || !!supplierId || !!minPrice || !!maxPrice || !!minMargin || !!maxMargin;
  const showAdvancedPanel = showFilters || smartQuery.matched;

  const query = useProducts({
    search: smartQuery.matched ? undefined : debouncedSearch,
    status: smartQuery.filters.status ?? (statusFilter === 'all' ? undefined : statusFilter),
    categoryId: categoryId || undefined,
    warehouseId: warehouseId || undefined,
    supplierId: supplierId || undefined,
    minPrice: smartQuery.filters.minPrice ?? (minPrice ? Number(minPrice) : undefined),
    maxPrice: smartQuery.filters.maxPrice ?? (maxPrice ? Number(maxPrice) : undefined),
    minMarginPct: minMargin ? Number(minMargin) : undefined,
    maxMarginPct: maxMargin ? Number(maxMargin) : undefined,
    expiryTo: smartQuery.filters.expiryTo,
  });

  const products = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);

  function clearAdvancedFilters() {
    setCategoryId('');
    setWarehouseId('');
    setSupplierId('');
    setMinPrice('');
    setMaxPrice('');
    setMinMargin('');
    setMaxMargin('');
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="px-5 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Inventory</Text>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push('/inventory/new');
            }}
            className="h-9 w-9 items-center justify-center rounded-full bg-accent dark:bg-accent-dark"
          >
            <Text className="text-[20px] font-bold text-white">+</Text>
          </Pressable>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, SKU, barcode…"
          placeholderTextColor="#aab2c4"
          className="mt-3 h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />

        <View className="mt-3 flex-row flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  haptics.select();
                  setStatusFilter(f.key);
                }}
                className={`rounded-full border px-3 py-1.5 ${
                  active
                    ? 'border-accent bg-accent-weak dark:border-accent-dark dark:bg-accent-weak-dark'
                    : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
                }`}
              >
                <Text
                  className={`text-[12.5px] font-semibold ${
                    active ? 'text-accent-text dark:text-accent-text-dark' : 'text-text-2 dark:text-text-2-dark'
                  }`}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              haptics.select();
              setShowFilters((v) => !v);
            }}
            className={`rounded-full border px-3 py-1.5 ${
              advancedFiltersActive
                ? 'border-accent bg-accent-weak dark:border-accent-dark dark:bg-accent-weak-dark'
                : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
            }`}
          >
            <Text
              className={`text-[12.5px] font-semibold ${
                advancedFiltersActive ? 'text-accent-text dark:text-accent-text-dark' : 'text-text-2 dark:text-text-2-dark'
              }`}
            >
              {showAdvancedPanel ? '▴' : '▾'} Filters{advancedFiltersActive ? ' •' : ''}
            </Text>
          </Pressable>
        </View>

        {showAdvancedPanel && (
          <View className="mt-3 gap-3 rounded-[9px] border border-border bg-surface-2 p-3 dark:border-border-dark dark:bg-surface-2-dark">
            <SelectField
              label="Category"
              value={categoryId}
              placeholder="All categories"
              options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              onChange={setCategoryId}
            />
            <SelectField
              label="Warehouse"
              value={warehouseId}
              placeholder="All warehouses"
              options={(warehousesQuery.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
              onChange={setWarehouseId}
            />
            <SelectField
              label="Supplier"
              value={supplierId}
              placeholder="All suppliers"
              options={(suppliersQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              onChange={setSupplierId}
            />
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Min price</Text>
                <TextInput
                  value={minPrice}
                  onChangeText={setMinPrice}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#aab2c4"
                  className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Max price</Text>
                <TextInput
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  keyboardType="numeric"
                  placeholder="Any"
                  placeholderTextColor="#aab2c4"
                  className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                />
              </View>
            </View>
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Min margin %</Text>
                <TextInput
                  value={minMargin}
                  onChangeText={setMinMargin}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#aab2c4"
                  className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Max margin %</Text>
                <TextInput
                  value={maxMargin}
                  onChangeText={setMaxMargin}
                  keyboardType="numeric"
                  placeholder="Any"
                  placeholderTextColor="#aab2c4"
                  className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                />
              </View>
            </View>
            {advancedFiltersActive && (
              <Pressable
                onPress={() => {
                  haptics.select();
                  clearAdvancedFilters();
                }}
                className="items-center rounded-[9px] border border-border bg-surface py-2 dark:border-border-dark dark:bg-surface-dark"
              >
                <Text className="text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Clear filters</Text>
              </Pressable>
            )}
          </View>
        )}

        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => router.push('/inventory/adjustments')}
            className="flex-1 items-center justify-center rounded-[9px] border border-border bg-surface py-2 dark:border-border-dark dark:bg-surface-dark"
          >
            <Text className="text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Adjustments</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/inventory/movements')}
            className="flex-1 items-center justify-center rounded-[9px] border border-border bg-surface py-2 dark:border-border-dark dark:bg-surface-dark"
          >
            <Text className="text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Movements</Text>
          </Pressable>
        </View>
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 px-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 pb-10"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          onEndReached={() => {
            if (query.hasNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState icon="📦" title="No products yet" description="Add your first product to start tracking inventory." />
          }
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status];
            return (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  router.push(`/inventory/${item.id}`);
                }}
                className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
              >
                <View className="h-11 w-11 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                  <Text className="text-[20px]">{item.emoji || '📦'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-[11.5px] text-muted dark:text-muted-dark">
                    {item.sku} · {formatMoney(item.sell_price, currency)}
                  </Text>
                </View>
                <View className={`rounded-full px-2 py-0.5 ${meta.badgeClass}`}>
                  <Text className={`text-[11px] font-bold ${meta.textClass}`}>
                    {item.qty_on_hand} {meta.label}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
