import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { archiveProduct, deleteProduct, setProductActive } from '@/lib/actions/products';
import { createAdjustment, transferWarehouseStock } from '@/lib/actions/inventory';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { useProduct, useWarehouses } from '@/lib/hooks/use-products';
import { isManagerRole } from '@/lib/roles';
import { useQueryClient } from '@tanstack/react-query';
import type { AdjustmentType } from '@/types/database';

const STATUS_STYLE: Record<string, string> = {
  in_stock: 'text-green dark:text-green-dark bg-green-weak dark:bg-green-weak-dark',
  low_stock: 'text-amber dark:text-amber-dark bg-amber-weak dark:bg-amber-weak-dark',
  out_of_stock: 'text-red dark:text-red-dark bg-red-weak dark:bg-red-weak-dark',
};

const ADJUSTMENT_REASONS: { label: string; adjustmentType: AdjustmentType; kind: 'adjustment' | 'expired'; sign: 1 | -1 | 0 }[] = [
  { label: 'Stock recount (increase)', adjustmentType: 'increase', kind: 'adjustment', sign: 1 },
  { label: 'Stock recount (decrease)', adjustmentType: 'count_correction', kind: 'adjustment', sign: -1 },
  { label: 'Damaged in transit', adjustmentType: 'damaged', kind: 'adjustment', sign: -1 },
  { label: 'Theft/loss', adjustmentType: 'loss', kind: 'adjustment', sign: -1 },
  { label: 'Past expiry date', adjustmentType: 'expired', kind: 'expired', sign: -1 },
  { label: 'Other', adjustmentType: 'other', kind: 'adjustment', sign: -1 },
];

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productQuery = useProduct(id ?? null);
  const profileQuery = useMyProfile();
  const currency = useOrgCurrency();
  const queryClient = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isManager = isManagerRole(profileQuery.data?.role ?? '');

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['product', id] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
  }

  async function handleToggleActive() {
    if (!productQuery.data) return;
    setBusy(true);
    try {
      await setProductActive(productQuery.data.id, !productQuery.data.is_active);
      haptics.success();
      invalidate();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update the product.');
    } finally {
      setBusy(false);
    }
  }

  function handleArchive() {
    if (!productQuery.data) return;
    Alert.alert('Archive product?', 'This hides it from active lists but keeps its history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await archiveProduct(productQuery.data!.id);
            haptics.success();
            router.back();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not archive the product.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function handleDelete() {
    if (!productQuery.data) return;
    Alert.alert('Delete product?', 'This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteProduct(productQuery.data!.id);
            haptics.success();
            router.back();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not delete the product.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (productQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-bg px-6 dark:bg-bg-dark">
        <Text className="text-[14px] text-text-2 dark:text-text-2-dark">Could not load this product.</Text>
        <Button onPress={() => productQuery.refetch()}>Try again</Button>
      </SafeAreaView>
    );
  }

  const product = productQuery.data;
  const margin = product.sell_price > 0 ? ((product.sell_price - product.cost_price) / product.sell_price) * 100 : 0;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        {isManager && (
          <Pressable onPress={() => router.push(`/inventory/${product.id}/edit`)} hitSlop={10}>
            <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Edit</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerClassName="p-5 pb-10">
        <View className="items-center">
          {product.image_url ? (
            <View className="h-20 w-20 overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark" />
          ) : (
            <View className="h-20 w-20 items-center justify-center rounded-2xl bg-accent-weak dark:bg-accent-weak-dark">
              <Text className="text-[32px]">{product.emoji || '📦'}</Text>
            </View>
          )}
          <Text className="mt-3 text-center text-[19px] font-bold text-text dark:text-text-dark">{product.name}</Text>
          <Text className="mt-0.5 text-[12.5px] text-muted dark:text-muted-dark">
            {product.sku}
            {product.barcode ? ` · ${product.barcode}` : ''}
          </Text>
          <View className={`mt-2 flex-row items-center gap-1.5 rounded-full px-3 py-1 ${STATUS_STYLE[product.status]}`}>
            <Text className="text-[12px] font-bold">
              {product.qty_on_hand} on hand · {product.status.replace('_', ' ')}
            </Text>
          </View>
          {!product.is_active && (
            <View className="mt-1.5 rounded-full bg-hover px-2.5 py-0.5 dark:bg-hover-dark">
              <Text className="text-[11px] font-bold text-muted dark:text-muted-dark">Inactive</Text>
            </View>
          )}
        </View>

        <View className="mt-6 flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[11px] font-semibold text-text-2 dark:text-text-2-dark">Sell price</Text>
            <Text className="mt-1 font-mono text-[16px] font-bold text-text dark:text-text-dark">
              {formatMoney(product.sell_price, currency)}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[11px] font-semibold text-text-2 dark:text-text-2-dark">Cost price</Text>
            <Text className="mt-1 font-mono text-[16px] font-bold text-text dark:text-text-dark">
              {formatMoney(product.cost_price, currency)}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[11px] font-semibold text-text-2 dark:text-text-2-dark">Margin</Text>
            <Text className="mt-1 font-mono text-[16px] font-bold text-text dark:text-text-dark">{margin.toFixed(0)}%</Text>
          </View>
        </View>

        <View className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Row label="Category" value={product.categories?.name ?? '—'} />
          <Row label="Supplier" value={product.suppliers?.name ?? '—'} />
          <Row label="Warehouse" value={product.warehouses?.name ?? '—'} />
          <Row label="Reorder level" value={String(product.reorder_level)} />
          <Row label="Damaged / Returned" value={`${product.qty_damaged} / ${product.qty_returned}`} />
          {product.expiry_date && <Row label="Expiry date" value={product.expiry_date} />}
          {product.batch_number && <Row label="Batch number" value={product.batch_number} last />}
        </View>

        {product.description && (
          <View className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[12.5px] leading-relaxed text-text-2 dark:text-text-2-dark">{product.description}</Text>
          </View>
        )}

        {isManager && (
          <View className="mt-5 gap-2.5">
            <Button variant="secondary" onPress={() => setAdjustOpen(true)}>
              Adjust stock
            </Button>
            <Button variant="secondary" onPress={() => setTransferOpen(true)}>
              Transfer to another warehouse
            </Button>
            <Button variant="secondary" loading={busy} onPress={handleToggleActive}>
              {product.is_active ? 'Mark inactive' : 'Mark active'}
            </Button>
            <Button variant="ghost" loading={busy} onPress={handleArchive}>
              Archive
            </Button>
            <Pressable onPress={handleDelete} className="items-center py-2">
              <Text className="text-[13px] font-semibold text-red dark:text-red-dark">Delete product</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <AdjustStockModal
        visible={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        productId={product.id}
        qtyOnHand={product.qty_on_hand}
        onDone={() => {
          setAdjustOpen(false);
          invalidate();
        }}
      />
      <TransferModal
        visible={transferOpen}
        onClose={() => setTransferOpen(false)}
        productId={product.id}
        currentWarehouseId={product.warehouse_id}
        onDone={() => {
          setTransferOpen(false);
          invalidate();
        }}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between py-2 ${last ? '' : 'border-b border-border-2 dark:border-border-2-dark'}`}>
      <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{label}</Text>
      <Text className="text-[12.5px] font-semibold text-text dark:text-text-dark">{value}</Text>
    </View>
  );
}

function AdjustStockModal({
  visible,
  onClose,
  productId,
  qtyOnHand,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  productId: string;
  qtyOnHand: number;
  onDone: () => void;
}) {
  const [reasonIdx, setReasonIdx] = useState(0);
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const reason = ADJUSTMENT_REASONS[reasonIdx];
    const parsedQty = Math.abs(Number(qty));
    if (!parsedQty || Number.isNaN(parsedQty)) {
      setError('Enter a quantity.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createAdjustment({
        productId,
        qtyDelta: reason.sign * parsedQty,
        reason: reason.label,
        notes: notes.trim() || undefined,
        adjustmentType: reason.adjustmentType,
        kind: reason.kind,
      });
      haptics.success();
      setQty('');
      setNotes('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the adjustment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
          <Text className="text-[16px] font-bold text-text dark:text-text-dark">Adjust stock</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerClassName="gap-3.5 p-5">
          <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">Currently {qtyOnHand} on hand.</Text>
          <SelectField
            label="Reason"
            value={String(reasonIdx)}
            options={ADJUSTMENT_REASONS.map((r, i) => ({ value: String(i), label: r.label }))}
            onChange={(v) => setReasonIdx(Number(v))}
          />
          <TextField label="Quantity" keyboardType="number-pad" value={qty} onChangeText={setQty} />
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
          {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}
          <Button loading={busy} onPress={submit}>
            Save adjustment
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TransferModal({
  visible,
  onClose,
  productId,
  currentWarehouseId,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  productId: string;
  currentWarehouseId: string | null;
  onDone: () => void;
}) {
  const warehousesQuery = useWarehouses();
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = (warehousesQuery.data ?? []).filter((w) => w.id !== currentWarehouseId).map((w) => ({ value: w.id, label: w.name }));

  async function submit() {
    if (!toWarehouseId) {
      setError('Pick a destination warehouse.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await transferWarehouseStock(productId, toWarehouseId, reason.trim() || undefined);
      haptics.success();
      setToWarehouseId('');
      setReason('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not transfer this product.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
          <Text className="text-[16px] font-bold text-text dark:text-text-dark">Transfer warehouse</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerClassName="gap-3.5 p-5">
          {options.length === 0 ? (
            <Text className="text-[13px] text-text-2 dark:text-text-2-dark">No other warehouses to transfer to.</Text>
          ) : (
            <>
              <SelectField label="Destination warehouse" placeholder="Select…" value={toWarehouseId} options={options} onChange={setToWarehouseId} />
              <TextField label="Reason (optional)" value={reason} onChangeText={setReason} multiline />
              {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}
              <Button loading={busy} onPress={submit}>
                Transfer product
              </Button>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
