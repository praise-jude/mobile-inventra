import { useQueryClient, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { createInvoice, type InvoiceItemInput } from '@/lib/actions/invoices';
import { searchProductsForPicker } from '@/lib/actions/inventory';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useOrgCurrency } from '@/lib/hooks/use-org-currency';

interface ItemDraft extends InvoiceItemInput {
  key: number;
}

let nextKey = 0;

function blankRow(): ItemDraft {
  return { key: nextKey++, description: '', quantity: 1, unitPrice: 0 };
}

// Mirrors Inventra/components/invoices/InvoiceModal.tsx.
export default function NewInvoiceScreen() {
  const queryClient = useQueryClient();
  const currency = useOrgCurrency();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([blankRow()]);
  const [productSearch, setProductSearch] = useState('');
  const debouncedSearch = useDebouncedValue(productSearch, 250);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productQuery = useQuery({
    queryKey: ['product-picker', debouncedSearch],
    queryFn: () => searchProductsForPicker(debouncedSearch),
    enabled: debouncedSearch.trim().length > 0,
  });

  function addBlankRow() {
    setItems((rows) => [...rows, blankRow()]);
  }

  function addProductRow(product: { id: string; name: string; sellPrice: number }) {
    setProductSearch('');
    setItems((rows) => {
      const blank = rows.find((r) => !r.description && !r.productId);
      const row: ItemDraft = { key: blank?.key ?? nextKey++, productId: product.id, description: product.name, quantity: 1, unitPrice: product.sellPrice };
      if (blank) return rows.map((r) => (r.key === blank.key ? row : r));
      return [...rows, row];
    });
  }

  function updateRow(key: number, patch: Partial<ItemDraft>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: number) {
    setItems((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0), [items]);
  const total = subtotal - (parseFloat(discountAmount) || 0) + (parseFloat(taxAmount) || 0);

  async function handleSave() {
    setError(null);
    const validItems = items.filter((i) => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      setError('Add at least one line item.');
      return;
    }
    setSaving(true);
    try {
      await createInvoice({
        customerName,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: dueDate || undefined,
        discountAmount: parseFloat(discountAmount) || 0,
        taxAmount: parseFloat(taxAmount) || 0,
        notes: notes || undefined,
        items: validItems.map((i) => ({ productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      });
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['invoices-overview'] });
      router.back();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not create this invoice.');
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
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">New invoice</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <TextField label="Customer name" value={customerName} onChangeText={setCustomerName} autoFocus />
        <TextField label="Email (optional)" value={customerEmail} onChangeText={setCustomerEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Phone (optional)" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
        <TextField label="Due date (YYYY-MM-DD, optional)" value={dueDate} onChangeText={setDueDate} />

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[13px] font-bold text-text dark:text-text-dark">Line items</Text>
            <Pressable onPress={addBlankRow}>
              <Text className="text-[12px] font-semibold text-accent-text dark:text-accent-text-dark">+ Add row</Text>
            </Pressable>
          </View>

          <TextInput
            value={productSearch}
            onChangeText={setProductSearch}
            placeholder="Search a product to add (optional)…"
            placeholderTextColor="#aab2c4"
            className="mb-2 h-9 rounded-[8px] border border-border bg-surface px-3 text-[13px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
          {(productQuery.data ?? []).length > 0 && (
            <View className="mb-2.5 gap-1.5">
              {productQuery.data!.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => addProductRow(p)}
                  className="flex-row items-center justify-between rounded-[8px] border border-border bg-surface px-3 py-2 dark:border-border-dark dark:bg-surface-dark"
                >
                  <Text className="text-[13px] text-text dark:text-text-dark">{p.name}</Text>
                  <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">{formatMoney(p.sellPrice, currency)}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View className="gap-2">
            {items.map((row) => (
              <View key={row.key} className="rounded-[10px] border border-border bg-surface p-2.5 dark:border-border-dark dark:bg-surface-dark">
                <TextInput
                  value={row.description}
                  onChangeText={(v) => updateRow(row.key, { description: v })}
                  placeholder="Description"
                  placeholderTextColor="#aab2c4"
                  className="mb-2 h-9 rounded-[7px] border border-border bg-bg px-2.5 text-[13px] text-text dark:border-border-dark dark:bg-bg-dark dark:text-text-dark"
                />
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={String(row.quantity)}
                    onChangeText={(v) => updateRow(row.key, { quantity: Number(v) || 0 })}
                    keyboardType="numeric"
                    placeholder="Qty"
                    placeholderTextColor="#aab2c4"
                    className="h-9 w-16 rounded-[7px] border border-border bg-bg px-2 text-right text-[13px] text-text dark:border-border-dark dark:bg-bg-dark dark:text-text-dark"
                  />
                  <TextInput
                    value={String(row.unitPrice)}
                    onChangeText={(v) => updateRow(row.key, { unitPrice: Number(v) || 0 })}
                    keyboardType="numeric"
                    placeholder="Unit price"
                    placeholderTextColor="#aab2c4"
                    className="h-9 flex-1 rounded-[7px] border border-border bg-bg px-2 text-right text-[13px] text-text dark:border-border-dark dark:bg-bg-dark dark:text-text-dark"
                  />
                  <Text className="w-20 text-right font-mono text-[12.5px] font-semibold text-text dark:text-text-dark">
                    {formatMoney(row.quantity * row.unitPrice, currency)}
                  </Text>
                  <Pressable onPress={() => removeRow(row.key)} hitSlop={8}>
                    <Text className="text-[13px] text-muted dark:text-muted-dark">✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="flex-row gap-2.5">
          <View className="flex-1">
            <TextField label="Discount" value={discountAmount} onChangeText={setDiscountAmount} keyboardType="numeric" />
          </View>
          <View className="flex-1">
            <TextField label="Tax" value={taxAmount} onChangeText={setTaxAmount} keyboardType="numeric" />
          </View>
        </View>
        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

        <View className="gap-1.5 rounded-[10px] border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-text-2 dark:text-text-2-dark">Subtotal</Text>
            <Text className="font-mono text-[13px] text-text-2 dark:text-text-2-dark">{formatMoney(subtotal, currency)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[15px] font-bold text-text dark:text-text-dark">Total</Text>
            <Text className="font-mono text-[15px] font-bold text-text dark:text-text-dark">{formatMoney(total, currency)}</Text>
          </View>
        </View>

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleSave} className="mt-2">
          Create invoice
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
