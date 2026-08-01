import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { createSupplyRecord } from '@/lib/actions/supply-records';
import { searchProductsForPicker, type ProductPickerRow } from '@/lib/actions/inventory';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useSuppliersDetailed } from '@/lib/hooks/use-suppliers';
import { useWarehouseOptions } from '@/lib/hooks/use-warehouse-options';

interface SupplyLine {
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Mirrors Inventra/components/supply-records/NewSupplyRecordForm.tsx —
// product search to build a line-item list, then a supplier/branch section.
export default function NewSupplyRecordScreen() {
  const currency = useOrgCurrency();
  const warehouseOptionsQuery = useWarehouseOptions();
  const suppliersQuery = useSuppliersDetailed();

  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateSupplied] = useState(todayIso());
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [lines, setLines] = useState<SupplyLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const searchQuery = useQuery({
    queryKey: ['product-picker', debouncedSearch],
    queryFn: () => searchProductsForPicker(debouncedSearch),
    enabled: debouncedSearch.trim().length > 0,
  });

  function addLine(product: ProductPickerRow) {
    haptics.tap();
    setLines((ls) => {
      if (ls.some((l) => l.productId === product.id)) return ls;
      return [...ls, { productId: product.id, name: product.name, quantity: 1, unitCost: 0 }];
    });
    setSearch('');
  }

  function updateLine(productId: string, patch: Partial<SupplyLine>) {
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    haptics.tap();
    setLines((ls) => ls.filter((l) => l.productId !== productId));
  }

  function selectSupplier(id: string) {
    setSupplierId(id);
    const s = suppliersQuery.data?.find((s) => s.id === id);
    if (s) {
      setSupplierName(s.name);
      setSupplierPhone(s.phone ?? '');
      setSupplierEmail(s.email ?? '');
    }
  }

  const totals = useMemo(() => {
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    const totalAmount = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
    return { totalQuantity, totalAmount };
  }, [lines]);

  async function handleSave() {
    setError(null);
    if (!supplierName.trim()) {
      setError('Supplier name is required.');
      return;
    }
    if (!warehouseId) {
      setError('Pick a branch.');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one product.');
      return;
    }
    setSaving(true);
    try {
      const id = await createSupplyRecord({
        supplierId: supplierId || undefined,
        supplierName,
        supplierPhone: supplierPhone || undefined,
        supplierEmail: supplierEmail || undefined,
        invoiceNumber: invoiceNumber || undefined,
        warehouseId,
        dateSupplied,
        notes: notes || undefined,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost })),
      });
      haptics.success();
      router.replace(`/supply-records/${id}`);
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not create the supply record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Cancel</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">New Supply Record</Text>
        <View className="w-14" />
      </View>

      <View className="border-b border-border-2 px-5 py-3 dark:border-border-2-dark">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search product name or SKU…"
          placeholderTextColor="#aab2c4"
          className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />
        {search.trim().length > 0 && (
          <View className="mt-2 max-h-[220px] overflow-hidden rounded-[9px] border border-border dark:border-border-dark">
            <FlatList
              data={searchQuery.data ?? []}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                !searchQuery.isFetching ? <Text className="p-3 text-[12.5px] text-muted dark:text-muted-dark">No products found.</Text> : null
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => addLine(item)}
                  className="flex-row items-center justify-between border-b border-border-2 bg-surface px-3 py-2.5 last:border-b-0 dark:border-border-2-dark dark:bg-surface-dark"
                >
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{item.name}</Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark">
                      {item.sku} · {item.qty} in stock
                    </Text>
                  </View>
                  <Text className="text-[12.5px] font-bold text-accent-text dark:text-accent-text-dark">Add</Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      <ScrollView contentContainerClassName="p-5 pb-10" keyboardShouldPersistTaps="handled">
        {lines.length === 0 ? (
          <Text className="py-8 text-center text-[13.5px] text-muted dark:text-muted-dark">Search above to add products to this supply.</Text>
        ) : (
          <View className="gap-2.5">
            {lines.map((line) => (
              <View key={line.productId} className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[13.5px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
                    {line.name}
                  </Text>
                  <Pressable onPress={() => removeLine(line.productId)} hitSlop={8}>
                    <Text className="text-[12px] font-semibold text-red dark:text-red-dark">Remove</Text>
                  </Pressable>
                </View>
                <View className="mt-2.5 flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="mb-1 text-[10.5px] font-semibold text-muted dark:text-muted-dark">Quantity</Text>
                    <TextInput
                      value={String(line.quantity)}
                      onChangeText={(v) => updateLine(line.productId, { quantity: Math.max(1, Number(v) || 1) })}
                      keyboardType="numeric"
                      className="h-9 rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-1 text-[10.5px] font-semibold text-muted dark:text-muted-dark">Unit cost</Text>
                    <TextInput
                      value={String(line.unitCost)}
                      onChangeText={(v) => updateLine(line.productId, { unitCost: Math.max(0, Number(v) || 0) })}
                      keyboardType="numeric"
                      className="h-9 rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                    />
                  </View>
                </View>
                <Text className="mt-2 text-right font-mono text-[13px] font-bold text-text dark:text-text-dark">
                  {formatMoney(line.quantity * line.unitCost, currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="mt-5 gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Text className="text-[13.5px] font-bold text-text dark:text-text-dark">Supplier</Text>
          {(suppliersQuery.data?.length ?? 0) > 0 && (
            <SelectField
              label="Existing supplier (optional)"
              value={supplierId}
              onChange={selectSupplier}
              options={[{ label: '— One-off / not in directory —', value: '' }, ...(suppliersQuery.data ?? []).map((s) => ({ label: s.name, value: s.id }))]}
            />
          )}
          <TextField label="Supplier name" value={supplierName} onChangeText={setSupplierName} />
          <TextField label="Phone (optional)" value={supplierPhone} onChangeText={setSupplierPhone} />
          <TextField label="Email (optional)" value={supplierEmail} onChangeText={setSupplierEmail} keyboardType="email-address" />
          <TextField label="Invoice number (optional)" value={invoiceNumber} onChangeText={setInvoiceNumber} />
          <SelectField
            label="Branch"
            value={warehouseId}
            onChange={setWarehouseId}
            options={(warehouseOptionsQuery.data ?? []).map((w) => ({ label: w.name, value: w.id }))}
          />
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} />
        </View>

        <View className="mt-4 flex-row items-center justify-between border-t border-border pt-3.5 dark:border-border-dark">
          <Text className="text-[13px] text-text-2 dark:text-text-2-dark">Total quantity</Text>
          <Text className="font-mono text-[13px] text-text dark:text-text-dark">{totals.totalQuantity}</Text>
        </View>
        <View className="mt-1.5 flex-row items-center justify-between">
          <Text className="text-[15px] font-bold text-text dark:text-text-dark">Total supply amount</Text>
          <Text className="font-mono text-[16px] font-bold text-text dark:text-text-dark">{formatMoney(totals.totalAmount, currency)}</Text>
        </View>

        {error && <Text className="mt-3 text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button onPress={handleSave} disabled={saving || lines.length === 0} className="mt-4">
          {saving ? 'Saving…' : 'Save supply record'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
