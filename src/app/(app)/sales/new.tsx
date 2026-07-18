import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeScannerModal } from '@/components/barcode-scanner';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { recordSale } from '@/lib/actions/sales';
import { findProductByCode, searchProductsForPicker, type ProductPickerRow } from '@/lib/actions/inventory';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useOrgCurrency, useOrgTaxRate } from '@/lib/hooks/use-org';
import { useWarehouses } from '@/lib/hooks/use-products';
import { useQuery } from '@tanstack/react-query';
import type { PaymentMethod } from '@/types/database';

interface CartLine {
  productId: string;
  name: string;
  price: number;
  availableQty: number;
  qty: number;
  discountPct: number;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'mobile_money', label: 'Mobile money' },
];

// Mirrors Inventra/components/sales/NewSaleForm.tsx — product search + scan
// to build a cart, then a checkout section. Totals shown here are for
// display only; recordSale re-derives every figure from live prices/stock
// right before insert (see lib/actions/sales.ts).
export default function NewSaleScreen() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = useOrgCurrency();
  const taxRate = useOrgTaxRate();
  const warehousesQuery = useWarehouses();

  const searchQuery = useQuery({
    queryKey: ['product-picker', debouncedSearch],
    queryFn: () => searchProductsForPicker(debouncedSearch),
    enabled: debouncedSearch.trim().length > 0,
  });

  function addToCart(product: ProductPickerRow) {
    haptics.tap();
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, qty: Math.min(l.qty + 1, l.availableQty) } : l));
      }
      return [
        ...prev,
        { productId: product.id, name: product.name, price: product.sellPrice, availableQty: product.qty, qty: 1, discountPct: 0 },
      ];
    });
    setSearch('');
  }

  async function handleScan(code: string) {
    setScannerOpen(false);
    const product = await findProductByCode(code).catch(() => null);
    if (!product) {
      setError(`No product found for "${code}".`);
      return;
    }
    addToCart(product);
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    haptics.tap();
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  // Display-only preview — recordSale re-derives every figure from live
  // prices/stock right before insert, so this can never drift into what's
  // actually billed, only what the cashier sees before charging.
  const { subtotal, discount, tax, total } = useMemo(() => {
    let sub = 0;
    let disc = 0;
    for (const line of cart) {
      const lineSubtotal = line.price * line.qty;
      sub += lineSubtotal;
      disc += lineSubtotal * (line.discountPct / 100);
    }
    const taxable = sub - disc;
    const t = taxable * (taxRate / 100);
    return { subtotal: sub, discount: disc, tax: t, total: taxable + t };
  }, [cart, taxRate]);

  async function handleCharge() {
    if (cart.length === 0) {
      setError('Add at least one product.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const id = await recordSale({
        warehouseId: warehouseId || undefined,
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty, discountPct: l.discountPct })),
        paymentMethod,
        notes: notes || undefined,
      });
      haptics.success();
      router.replace(`/sales/${id}`);
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not record the sale.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Cancel</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">New Sale</Text>
        <View className="w-14" />
      </View>

      <View className="border-b border-border-2 px-5 py-3 dark:border-border-2-dark">
        <View className="flex-row items-center gap-2">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search product name or SKU…"
            placeholderTextColor="#aab2c4"
            className="h-[42px] flex-1 rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
          <Pressable
            onPress={() => setScannerOpen(true)}
            className="h-[42px] w-[42px] items-center justify-center rounded-[9px] bg-accent dark:bg-accent-dark"
          >
            <Text className="text-[18px]">📷</Text>
          </Pressable>
        </View>

        {search.trim().length > 0 && (
          <View className="mt-2 max-h-[220px] overflow-hidden rounded-[9px] border border-border dark:border-border-dark">
            <FlatList
              data={searchQuery.data ?? []}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                !searchQuery.isFetching ? (
                  <Text className="p-3 text-[12.5px] text-muted dark:text-muted-dark">No products found.</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => addToCart(item)}
                  className="flex-row items-center justify-between border-b border-border-2 bg-surface px-3 py-2.5 last:border-b-0 dark:border-border-2-dark dark:bg-surface-dark"
                >
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{item.name}</Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark">{item.sku} · {item.qty} in stock</Text>
                  </View>
                  <Text className="text-[12.5px] font-bold text-accent-text dark:text-accent-text-dark">Add</Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      <ScrollView contentContainerClassName="p-5 pb-10" keyboardShouldPersistTaps="handled">
        {cart.length === 0 ? (
          <Text className="py-8 text-center text-[13.5px] text-muted dark:text-muted-dark">
            Search or scan a product to start this sale.
          </Text>
        ) : (
          <View className="gap-2.5">
            {cart.map((line) => (
              <View key={line.productId} className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark" numberOfLines={2}>
                      {line.name}
                    </Text>
                    <Text className="mt-0.5 font-mono text-[12px] text-muted dark:text-muted-dark">
                      {formatMoney(line.price, currency)} ×{line.qty} = {formatMoney(line.price * line.qty * (1 - line.discountPct / 100), currency)}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeLine(line.productId)} hitSlop={8}>
                    <Text className="text-[13px] font-semibold text-red dark:text-red-dark">Remove</Text>
                  </Pressable>
                </View>
                <View className="mt-2.5 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      onPress={() => updateLine(line.productId, { qty: Math.max(1, line.qty - 1) })}
                      className="h-8 w-8 items-center justify-center rounded-[8px] bg-hover dark:bg-hover-dark"
                    >
                      <Text className="text-[16px] font-bold text-text dark:text-text-dark">−</Text>
                    </Pressable>
                    <Text className="w-8 text-center font-mono text-[14px] font-bold text-text dark:text-text-dark">{line.qty}</Text>
                    <Pressable
                      onPress={() => updateLine(line.productId, { qty: Math.min(line.availableQty, line.qty + 1) })}
                      className="h-8 w-8 items-center justify-center rounded-[8px] bg-hover dark:bg-hover-dark"
                    >
                      <Text className="text-[16px] font-bold text-text dark:text-text-dark">+</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-[11.5px] text-text-2 dark:text-text-2-dark">Discount</Text>
                    <TextInput
                      value={String(line.discountPct)}
                      onChangeText={(v) => updateLine(line.productId, { discountPct: Math.min(100, Math.max(0, Number(v) || 0)) })}
                      keyboardType="number-pad"
                      className="h-8 w-14 rounded-[7px] border border-border bg-bg px-2 text-center text-[12.5px] text-text dark:border-border-dark dark:bg-bg-dark dark:text-text-dark"
                    />
                    <Text className="text-[11.5px] text-text-2 dark:text-text-2-dark">%</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View className="mt-6 gap-3.5">
          {(warehousesQuery.data ?? []).length > 0 && (
            <SelectField
              label="Warehouse (optional)"
              placeholder="Select warehouse…"
              value={warehouseId}
              options={(warehousesQuery.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
              onChange={setWarehouseId}
            />
          )}
          <SelectField label="Payment method" value={paymentMethod} options={PAYMENT_OPTIONS} onChange={(v) => setPaymentMethod(v as PaymentMethod)} />
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

          {cart.length > 0 && (
            <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <TotalRow label="Subtotal" value={formatMoney(subtotal, currency)} />
              {discount > 0 && <TotalRow label="Discount" value={`-${formatMoney(discount, currency)}`} />}
              {taxRate > 0 && <TotalRow label={`Tax (${taxRate}%)`} value={formatMoney(tax, currency)} />}
              <View className="mt-1.5 flex-row items-center justify-between border-t border-border-2 pt-1.5 dark:border-border-2-dark">
                <Text className="text-[14px] font-bold text-text dark:text-text-dark">Total</Text>
                <Text className="font-mono text-[16px] font-bold text-text dark:text-text-dark">{formatMoney(total, currency)}</Text>
              </View>
            </View>
          )}

          {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

          <Button loading={submitting} disabled={cart.length === 0} onPress={handleCharge}>
            {cart.length === 0 ? 'Add a product to charge' : `Charge ${formatMoney(total, currency)}`}
          </Button>
        </View>
      </ScrollView>

      <BarcodeScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </SafeAreaView>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{label}</Text>
      <Text className="font-mono text-[12.5px] font-semibold text-text dark:text-text-dark">{value}</Text>
    </View>
  );
}
