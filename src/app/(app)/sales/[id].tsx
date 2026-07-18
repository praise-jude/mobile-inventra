import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { deleteSale, updateSale } from '@/lib/actions/sales';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useSaleDetail } from '@/lib/hooks/use-sales';
import { isManagerRole } from '@/lib/roles';
import { useQueryClient } from '@tanstack/react-query';
import type { PaymentMethod } from '@/types/database';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  mobile_money: 'Mobile money',
};

// Mirrors Inventra/components/sales/SaleDetailSlideOver.tsx +
// ReceiptModal.tsx, merged into one screen. Web prints/downloads a PDF via
// the browser; mobile's equivalent is expo-print (renders the same receipt
// HTML to a PDF file) + expo-sharing (native share sheet) instead.
export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const saleQuery = useSaleDetail(id ?? null);
  const profileQuery = useMyProfile();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isManager = isManagerRole(profileQuery.data?.role ?? '');

  async function handleShare() {
    if (!saleQuery.data) return;
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: receiptHtml(saleQuery.data) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: saleQuery.data.receiptNumber });
      }
    } catch {
      Alert.alert('Error', 'Could not generate the receipt.');
    } finally {
      setSharing(false);
    }
  }

  function handleDelete() {
    Alert.alert('Delete this sale?', "This reverses its stock impact and can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteSale(id!);
            haptics.success();
            router.back();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not delete this sale.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (saleQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (saleQuery.isError || !saleQuery.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-bg px-6 dark:bg-bg-dark">
        <Text className="text-[14px] text-text-2 dark:text-text-2-dark">Could not load this sale.</Text>
        <Button onPress={() => saleQuery.refetch()}>Try again</Button>
      </SafeAreaView>
    );
  }

  const sale = saleQuery.data;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">{sale.receiptNumber}</Text>
        <Pressable onPress={() => setEditOpen(true)} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="p-5 pb-10">
        <View className="items-center border-b border-dashed border-border pb-4 dark:border-border-dark">
          <Text className="text-[16px] font-bold text-text dark:text-text-dark">{sale.orgName}</Text>
          {sale.branchName && <Text className="text-[12px] text-muted dark:text-muted-dark">{sale.branchName}</Text>}
          <Text className="mt-1 text-[11.5px] text-muted dark:text-muted-dark">
            {new Date(sale.createdAt).toLocaleString()}
          </Text>
          <Text className="text-[11.5px] text-muted dark:text-muted-dark">{sale.customerName}</Text>
          {sale.cashierName && <Text className="text-[11.5px] text-muted dark:text-muted-dark">Cashier: {sale.cashierName}</Text>}
        </View>

        <View className="border-b border-dashed border-border py-4 dark:border-border-dark">
          {sale.items.map((item) => (
            <View key={item.id} className="mb-2.5 flex-row justify-between">
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{item.productName}</Text>
                <Text className="text-[11px] text-muted dark:text-muted-dark">
                  {item.qty} × {formatMoney(item.unitPrice, sale.currency)}
                </Text>
              </View>
              <Text className="font-mono text-[13px] font-bold text-text dark:text-text-dark">
                {formatMoney(item.lineTotal, sale.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View className="border-b border-dashed border-border py-4 dark:border-border-dark">
          <TotalLine label="Subtotal" value={formatMoney(sale.subtotal, sale.currency)} />
          {sale.discountAmount > 0 && <TotalLine label="Discount" value={`-${formatMoney(sale.discountAmount, sale.currency)}`} />}
          {sale.taxAmount > 0 && <TotalLine label="Tax" value={formatMoney(sale.taxAmount, sale.currency)} />}
          <View className="mt-1.5 flex-row justify-between">
            <Text className="text-[15px] font-bold text-text dark:text-text-dark">Total</Text>
            <Text className="font-mono text-[16px] font-bold text-text dark:text-text-dark">{formatMoney(sale.total, sale.currency)}</Text>
          </View>
          {sale.payments.map((p, i) => (
            <TotalLine key={i} label={`Paid via ${PAYMENT_LABELS[p.method]}`} value={formatMoney(p.amount, sale.currency)} />
          ))}
        </View>

        {sale.notes && (
          <View className="border-b border-dashed border-border py-4 dark:border-border-dark">
            <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{sale.notes}</Text>
          </View>
        )}

        <View className="mt-6 gap-2.5">
          <Button loading={sharing} onPress={handleShare}>
            Share receipt (PDF)
          </Button>
          {isManager && (
            <Pressable onPress={handleDelete} className="items-center py-2" disabled={deleting}>
              <Text className="text-[13px] font-semibold text-red dark:text-red-dark">{deleting ? 'Deleting…' : 'Delete sale'}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <EditSaleModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        saleId={id!}
        initialNotes={sale.notes ?? ''}
        initialPaymentMethod={sale.payments[0]?.method ?? 'cash'}
        onSaved={() => {
          setEditOpen(false);
          queryClient.invalidateQueries({ queryKey: ['sale-detail', id] });
        }}
      />
    </SafeAreaView>
  );
}

function TotalLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-0.5">
      <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{label}</Text>
      <Text className="font-mono text-[12.5px] text-text-2 dark:text-text-2-dark">{value}</Text>
    </View>
  );
}

function EditSaleModal({
  visible,
  onClose,
  saleId,
  initialNotes,
  initialPaymentMethod,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  saleId: string;
  initialNotes: string;
  initialPaymentMethod: PaymentMethod;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialPaymentMethod);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await updateSale(saleId, { notes, paymentMethod });
      haptics.success();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this sale.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
          <Text className="text-[16px] font-bold text-text dark:text-text-dark">Edit sale</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Close</Text>
          </Pressable>
        </View>
        <View className="gap-3.5 p-5">
          <SelectField
            label="Payment method"
            value={paymentMethod}
            options={Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={(v) => setPaymentMethod(v as PaymentMethod)}
          />
          <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
          {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}
          <Button loading={busy} onPress={submit}>
            Save changes
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function receiptHtml(sale: NonNullable<ReturnType<typeof useSaleDetail>['data']>): string {
  const rows = sale.items
    .map(
      (i) =>
        `<tr><td>${i.productName}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${formatMoney(i.lineTotal, sale.currency)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
    .muted { color: #6b7280; font-size: 11px; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    td { padding: 4px 0; border-bottom: 1px dashed #e5e7eb; }
    .totals td { border-bottom: none; }
    .total-row td { font-weight: bold; font-size: 14px; padding-top: 8px; }
  </style></head><body>
    <h1>${sale.orgName}</h1>
    ${sale.branchName ? `<div class="muted">${sale.branchName}</div>` : ''}
    <div class="muted">${sale.receiptNumber} · ${new Date(sale.createdAt).toLocaleString()}</div>
    <div class="muted">${sale.customerName}</div>
    <table>${rows}</table>
    <table class="totals">
      <tr><td>Subtotal</td><td style="text-align:right">${formatMoney(sale.subtotal, sale.currency)}</td></tr>
      ${sale.discountAmount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${formatMoney(sale.discountAmount, sale.currency)}</td></tr>` : ''}
      ${sale.taxAmount > 0 ? `<tr><td>Tax</td><td style="text-align:right">${formatMoney(sale.taxAmount, sale.currency)}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td style="text-align:right">${formatMoney(sale.total, sale.currency)}</td></tr>
    </table>
  </body></html>`;
}
