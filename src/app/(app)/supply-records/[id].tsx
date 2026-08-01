import { useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { Button } from '@/components/ui/button';
import { changeSupplyRecordStatus, softDeleteSupplyRecord } from '@/lib/actions/supply-records';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useSupplyRecordDetail, type SupplyRecordDetail } from '@/lib/hooks/use-supply-records';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { isManagerRole } from '@/lib/roles';
import type { SupplyStatus } from '@/types/database';

const STATUS_STYLE: Record<SupplyStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'text-amber dark:text-amber-dark bg-amber-weak dark:bg-amber-weak-dark' },
  received: { label: 'Received', className: 'text-sky dark:text-sky-dark bg-sky-weak dark:bg-sky-weak-dark' },
  verified: { label: 'Verified', className: 'text-green dark:text-green-dark bg-green-weak dark:bg-green-weak-dark' },
  cancelled: { label: 'Cancelled', className: 'text-red dark:text-red-dark bg-red-weak dark:bg-red-weak-dark' },
};

const NEXT_STATUS: Record<SupplyStatus, { value: 'received' | 'verified' | 'cancelled'; label: string }[]> = {
  pending: [
    { value: 'received', label: 'Mark Received' },
    { value: 'cancelled', label: 'Cancel' },
  ],
  received: [
    { value: 'verified', label: 'Mark Verified' },
    { value: 'cancelled', label: 'Cancel' },
  ],
  verified: [{ value: 'cancelled', label: 'Cancel' }],
  cancelled: [],
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function supplyHtml(record: SupplyRecordDetail, currency: string): string {
  const rows = record.items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.productName)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${formatMoney(i.unitCost, currency)}</td><td style="text-align:right">${formatMoney(i.lineTotal, currency)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 18px; margin: 0; }
    .muted { color: #6b7280; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    td { padding: 4px 0; border-bottom: 1px dashed #e5e7eb; }
    .total-row td { font-weight: bold; font-size: 14px; padding-top: 8px; border-bottom: none; }
  </style></head><body>
    <h1>Supply ${escapeHtml(record.referenceNumber)}</h1>
    <div class="muted">Status: ${record.status.toUpperCase()} · Date: ${record.dateSupplied}</div>
    <div class="muted">Supplier: ${escapeHtml(record.supplierName)}</div>
    ${record.invoiceNumber ? `<div class="muted">Invoice: ${escapeHtml(record.invoiceNumber)}</div>` : ''}
    <table><thead><tr><td>Product</td><td style="text-align:center">Qty</td><td style="text-align:right">Unit cost</td><td style="text-align:right">Line total</td></tr></thead>${rows}
      <tr class="total-row"><td colspan="3">Total</td><td style="text-align:right">${formatMoney(record.totalAmount, currency)}</td></tr>
    </table>
    ${record.notes ? `<div class="muted" style="margin-top:16px">${escapeHtml(record.notes)}</div>` : ''}
  </body></html>`;
}

// Mirrors Inventra/components/supply-records/SupplyRecordDetailClient.tsx.
export default function SupplyRecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useSupplyRecordDetail(id ?? null);
  const profileQuery = useMyProfile();
  const currency = useOrgCurrency();
  const queryClient = useQueryClient();
  const isManager = isManagerRole(profileQuery.data?.role ?? '');

  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['supply-record-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['supply-records-list'] });
    queryClient.invalidateQueries({ queryKey: ['supply-records-totals'] });
  }

  async function handleStatusChange(next: 'received' | 'verified' | 'cancelled') {
    if (!id) return;
    function run() {
      setBusy(true);
      changeSupplyRecordStatus(id!, next)
        .then(() => {
          haptics.success();
          invalidate();
        })
        .catch((err) => {
          haptics.warning();
          notifyAlert('Error', err instanceof Error ? err.message : 'Could not update this supply record.');
        })
        .finally(() => setBusy(false));
    }
    if (next === 'cancelled') {
      confirmAlert('Cancel this supply?', 'Any stock it already added will be reversed.', [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel supply', style: 'destructive', onPress: run },
      ]);
    } else {
      run();
    }
  }

  async function handleDelete() {
    if (!id || !query.data) return;
    confirmAlert(`Delete ${query.data.referenceNumber}?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          softDeleteSupplyRecord(id)
            .then(() => {
              haptics.success();
              router.replace('/supply-records');
            })
            .catch((err) => {
              haptics.warning();
              notifyAlert('Error', err instanceof Error ? err.message : 'Could not delete this supply record.');
              setBusy(false);
            });
        },
      },
    ]);
  }

  async function handleShare() {
    if (!query.data) return;
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: supplyHtml(query.data, currency) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: query.data.referenceNumber });
      }
    } catch {
      notifyAlert('Error', 'Could not generate the supply PDF.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Supply Record</Text>
        <Pressable onPress={handleShare} disabled={sharing || !query.data} hitSlop={10}>
          {sharing ? <ActivityIndicator size="small" /> : <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Share</Text>}
        </Pressable>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError || !query.data ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <ScrollView contentContainerClassName="p-5 pb-10">
          <View className="flex-row items-center gap-2.5">
            <Text className="text-[19px] font-bold text-text dark:text-text-dark">{query.data.referenceNumber}</Text>
            <View className={`self-start rounded-full px-2.5 py-1 ${STATUS_STYLE[query.data.status].className}`}>
              <Text className={`text-[11px] font-bold ${STATUS_STYLE[query.data.status].className}`}>{STATUS_STYLE[query.data.status].label}</Text>
            </View>
          </View>
          <Text className="mt-1 text-[13px] text-text-2 dark:text-text-2-dark">
            {query.data.supplierName} · {query.data.dateSupplied} · {query.data.warehouseName ?? '—'}
          </Text>

          <View className="mt-4 flex-row flex-wrap gap-2.5">
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Total quantity</Text>
              <Text className="font-mono text-[17px] font-bold text-text dark:text-text-dark">{query.data.totalQuantity}</Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] text-muted dark:text-muted-dark">Total amount</Text>
              <Text className="font-mono text-[17px] font-bold text-text dark:text-text-dark">{formatMoney(query.data.totalAmount, currency)}</Text>
            </View>
          </View>

          <Text className="mb-2.5 mt-5 text-[14px] font-bold text-text dark:text-text-dark">Products</Text>
          <View className="gap-2">
            {query.data.items.map((i) => (
              <View
                key={i.id}
                className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
              >
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{i.productName}</Text>
                  <Text className="text-[11px] text-muted dark:text-muted-dark">
                    {i.quantity} × {formatMoney(i.unitCost, currency)}
                  </Text>
                </View>
                <Text className="font-mono text-[13px] font-bold text-text dark:text-text-dark">{formatMoney(i.lineTotal, currency)}</Text>
              </View>
            ))}
          </View>

          {query.data.notes && (
            <View className="mt-4 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[11px] font-semibold text-muted dark:text-muted-dark">Notes</Text>
              <Text className="mt-1 text-[13px] text-text dark:text-text-dark">{query.data.notes}</Text>
            </View>
          )}

          {isManager && (
            <View className="mt-5 gap-2.5">
              {NEXT_STATUS[query.data.status].map((n) => (
                <Button key={n.value} variant={n.value === 'cancelled' ? 'secondary' : 'primary'} disabled={busy} onPress={() => handleStatusChange(n.value)}>
                  {n.label}
                </Button>
              ))}
              {(query.data.status === 'pending' || query.data.status === 'cancelled') && (
                <Button variant="ghost" disabled={busy} onPress={handleDelete}>
                  Delete
                </Button>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
