import { useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { Button } from '@/components/ui/button';
import { deleteInvoice, updateInvoiceStatus } from '@/lib/actions/invoices';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useEntitlements } from '@/lib/hooks/use-entitlements';
import { useInvoiceDetail } from '@/lib/hooks/use-invoices';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org-currency';
import { isManagerRole } from '@/lib/roles';
import { useUpgradeModal } from '@/lib/upgrade-modal-context';
import type { CustomerInvoiceStatus } from '@/types/database';

const STATUS_STYLE: Record<CustomerInvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'text-muted dark:text-muted-dark bg-border-2 dark:bg-border-2-dark' },
  sent: { label: 'Sent', className: 'text-sky dark:text-sky-dark bg-sky-weak dark:bg-sky-weak-dark' },
  paid: { label: 'Paid', className: 'text-green dark:text-green-dark bg-green-weak dark:bg-green-weak-dark' },
  overdue: { label: 'Overdue', className: 'text-red dark:text-red-dark bg-red-weak dark:bg-red-weak-dark' },
  void: { label: 'Void', className: 'text-muted dark:text-muted-dark bg-border-2 dark:bg-border-2-dark' },
};
const STATUS_OPTIONS: CustomerInvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'void'];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function invoiceHtml(invoice: NonNullable<ReturnType<typeof useInvoiceDetail>['data']>, currency: string): string {
  const rows = invoice.items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.description)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${formatMoney(i.unitPrice, currency)}</td><td style="text-align:right">${formatMoney(i.lineTotal, currency)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 18px; margin: 0; }
    .muted { color: #6b7280; font-size: 11px; }
    .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    td { padding: 4px 0; border-bottom: 1px dashed #e5e7eb; }
    .totals td { border-bottom: none; }
    .total-row td { font-weight: bold; font-size: 14px; padding-top: 8px; }
  </style></head><body>
    <h1>Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
    <div class="muted">Status: ${invoice.status.toUpperCase()} · Issued: ${invoice.issueDate}${invoice.dueDate ? ` · Due: ${invoice.dueDate}` : ''}</div>
    <div class="muted">Bill to: ${escapeHtml(invoice.customerName)}</div>
    ${invoice.customerEmail ? `<div class="muted">${escapeHtml(invoice.customerEmail)}</div>` : ''}
    ${invoice.customerPhone ? `<div class="muted">${escapeHtml(invoice.customerPhone)}</div>` : ''}
    <table><thead><tr><td>Description</td><td style="text-align:center">Qty</td><td style="text-align:right">Unit price</td><td style="text-align:right">Line total</td></tr></thead>${rows}</table>
    <table class="totals">
      <tr><td>Subtotal</td><td style="text-align:right">${formatMoney(invoice.subtotal, currency)}</td></tr>
      ${invoice.discountAmount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${formatMoney(invoice.discountAmount, currency)}</td></tr>` : ''}
      ${invoice.taxAmount > 0 ? `<tr><td>Tax</td><td style="text-align:right">${formatMoney(invoice.taxAmount, currency)}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td style="text-align:right">${formatMoney(invoice.total, currency)}</td></tr>
    </table>
    ${invoice.notes ? `<div class="footer">${escapeHtml(invoice.notes)}</div>` : ''}
    <div class="footer">Thank you for your business.</div>
  </body></html>`;
}

// Mirrors Inventra/components/invoices/InvoiceDetailSlideOver.tsx.
export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useInvoiceDetail(id ?? null);
  const profileQuery = useMyProfile();
  const entitlementsQuery = useEntitlements();
  const isPremium = entitlementsQuery.data?.tier === 'premium';
  const { openUpgradeModal } = useUpgradeModal();
  const currency = useOrgCurrency();
  const queryClient = useQueryClient();
  const canManage = isManagerRole(profileQuery.data?.role ?? '');

  const [statusBusy, setStatusBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['invoices-overview'] });
  }

  async function handleStatusChange(status: CustomerInvoiceStatus) {
    if (!id) return;
    setStatusBusy(true);
    try {
      await updateInvoiceStatus(id, status);
      haptics.success();
      invalidate();
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not update the status.');
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleShare() {
    if (!isPremium) {
      openUpgradeModal();
      return;
    }
    if (!query.data) return;
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: invoiceHtml(query.data, currency) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: query.data.invoiceNumber });
      }
    } catch {
      notifyAlert('Error', 'Could not generate the invoice PDF.');
    } finally {
      setSharing(false);
    }
  }

  function handleDelete() {
    if (!id || !query.data) return;
    confirmAlert(`Delete invoice ${query.data.invoiceNumber}?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteInvoice(id);
            haptics.success();
            router.back();
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not delete this invoice.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (query.isLoading || !query.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        {query.isError ? <ErrorState onRetry={() => query.refetch()} /> : <ActivityIndicator />}
      </SafeAreaView>
    );
  }

  const invoice = query.data;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">{invoice.invoiceNumber}</Text>
        <View className="w-12" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5 pb-10">
        <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Text className="text-[16px] font-bold text-text dark:text-text-dark">{invoice.customerName}</Text>
          <View className={`mt-1.5 self-start rounded-full px-2 py-0.5 ${STATUS_STYLE[invoice.status].className}`}>
            <Text className={`text-[10.5px] font-bold ${STATUS_STYLE[invoice.status].className}`}>{STATUS_STYLE[invoice.status].label}</Text>
          </View>
          {invoice.customerEmail && <Text className="mt-2 text-[12.5px] text-text-2 dark:text-text-2-dark">{invoice.customerEmail}</Text>}
          {invoice.customerPhone && <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{invoice.customerPhone}</Text>}
          <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">Issued {invoice.issueDate}</Text>
          {invoice.dueDate && <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">Due {invoice.dueDate}</Text>}
        </View>

        {canManage && (
          <View>
            <Text className="mb-1.5 text-[12px] font-semibold text-text-2 dark:text-text-2-dark">Status</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleStatusChange(s)}
                  disabled={statusBusy || s === invoice.status}
                  className={`rounded-full px-3 py-1.5 ${s === invoice.status ? 'bg-accent dark:bg-accent-dark' : 'border border-border bg-surface dark:border-border-dark dark:bg-surface-dark'}`}
                >
                  <Text className={`text-[12px] font-semibold ${s === invoice.status ? 'text-white' : 'text-text dark:text-text-dark'}`}>
                    {STATUS_STYLE[s].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View>
          <Text className="mb-2 text-[13px] font-bold text-text dark:text-text-dark">Line items</Text>
          <View className="gap-2">
            {invoice.items.map((i) => (
              <View key={i.id} className="flex-row items-center justify-between rounded-[10px] border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{i.description}</Text>
                  <Text className="text-[11px] text-muted dark:text-muted-dark">
                    {i.quantity} × {formatMoney(i.unitPrice, currency)}
                  </Text>
                </View>
                <Text className="font-mono text-[13px] font-bold text-text dark:text-text-dark">{formatMoney(i.lineTotal, currency)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-1.5 rounded-[10px] border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-text-2 dark:text-text-2-dark">Subtotal</Text>
            <Text className="font-mono text-[13px] text-text-2 dark:text-text-2-dark">{formatMoney(invoice.subtotal, currency)}</Text>
          </View>
          {invoice.discountAmount > 0 && (
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-text-2 dark:text-text-2-dark">Discount</Text>
              <Text className="font-mono text-[13px] text-text-2 dark:text-text-2-dark">-{formatMoney(invoice.discountAmount, currency)}</Text>
            </View>
          )}
          {invoice.taxAmount > 0 && (
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-text-2 dark:text-text-2-dark">Tax</Text>
              <Text className="font-mono text-[13px] text-text-2 dark:text-text-2-dark">{formatMoney(invoice.taxAmount, currency)}</Text>
            </View>
          )}
          <View className="flex-row justify-between">
            <Text className="text-[15px] font-bold text-text dark:text-text-dark">Total</Text>
            <Text className="font-mono text-[15px] font-bold text-text dark:text-text-dark">{formatMoney(invoice.total, currency)}</Text>
          </View>
        </View>

        {invoice.notes && (
          <View className="rounded-[10px] border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{invoice.notes}</Text>
          </View>
        )}

        <View className="mt-2 gap-2.5">
          <Button loading={sharing} onPress={handleShare}>
            Share invoice (PDF){!isPremium ? ' (PRO)' : ''}
          </Button>
          {canManage && (
            <Pressable onPress={handleDelete} className="items-center py-2" disabled={deleting}>
              <Text className="text-[13px] font-semibold text-red dark:text-red-dark">{deleting ? 'Deleting…' : 'Delete invoice'}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
