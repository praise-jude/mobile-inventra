import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { decideApprovalRequest, listPendingApprovals, type PendingApprovalRow } from '@/lib/actions/approvals';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useOrgCurrency } from '@/lib/hooks/use-org';

const ENTITY_ICON: Record<string, string> = { discount: '🏷️', void_sale: '🗑️', price_change: '💲' };
const ENTITY_LABEL: Record<string, string> = { discount: 'Discount', void_sale: 'Void sale', price_change: 'Price change' };

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function summarize(request: PendingApprovalRow, currency: string): string {
  const p = request.payload as Record<string, any>;
  if (request.entityType === 'discount') {
    const computed = p.computed ?? {};
    return `${computed.maxDiscountPct ?? '?'}% discount on a sale of ${formatMoney(Number(computed.total ?? 0), currency)}`;
  }
  if (request.entityType === 'void_sale') {
    return `Void a sale worth ${formatMoney(Number(p.total ?? 0), currency)}`;
  }
  if (request.entityType === 'price_change') {
    const before = p.before ?? {};
    const input = p.input ?? {};
    return `"${before.name ?? 'Product'}": cost ${formatMoney(Number(before.cost_price ?? 0), currency)} → ${formatMoney(Number(input.costPrice ?? 0), currency)}, sell ${formatMoney(Number(before.sell_price ?? 0), currency)} → ${formatMoney(Number(input.sellPrice ?? 0), currency)}`;
  }
  return 'Requested change';
}

// Mirrors Inventra/components/approvals/ApprovalsClient.tsx.
export default function ApprovalsScreen() {
  const queryClient = useQueryClient();
  const currency = useOrgCurrency();
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['pending-approvals'], queryFn: listPendingApprovals });

  // Realtime so a request created (or decided elsewhere) shows up
  // immediately — same pattern as use-notifications.ts's channel.
  useEffect(() => {
    const channel = supabase
      .channel('approval-requests:pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await decideApprovalRequest(id, 'approved');
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not approve this request.');
    } finally {
      setBusyId(null);
    }
  }

  function handleReject(id: string) {
    confirmAlert('Reject this request?', 'The requester will be notified.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await decideApprovalRequest(id, 'rejected');
            haptics.success();
            queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not reject this request.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  if (query.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (query.isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <ErrorState onRetry={() => query.refetch()} />
      </SafeAreaView>
    );
  }

  const requests = query.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="border-b border-border px-4 py-3 dark:border-border-dark">
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Approvals</Text>
        <Text className="text-[12px] text-muted dark:text-muted-dark">Discounts, voids, and price changes waiting on your sign-off</Text>
      </View>

      {requests.length === 0 ? (
        <EmptyState icon="✅" title="No pending approvals" description="Discount, void, and price-change requests will show up here." />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-3 p-4"
          renderItem={({ item }) => (
            <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <View className="mb-2.5 flex-row items-center gap-2.5">
                <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                  <Text className="text-[16px]">{ENTITY_ICON[item.entityType] ?? '❓'}</Text>
                </View>
                <View>
                  <Text className="text-[13.5px] font-bold text-text dark:text-text-dark">{ENTITY_LABEL[item.entityType] ?? item.entityType}</Text>
                  <Text className="text-[12px] text-muted dark:text-muted-dark">
                    {item.requestedByName} · {timeAgo(item.requestedAt)}
                  </Text>
                </View>
              </View>
              <Text className="mb-3.5 text-[13.5px] text-text dark:text-text-dark">{summarize(item, currency)}</Text>
              <View className="flex-row justify-end gap-2.5">
                <Pressable
                  onPress={() => handleReject(item.id)}
                  disabled={busyId === item.id}
                  className="rounded-[10px] border border-border px-3.5 py-2 dark:border-border-dark"
                >
                  <Text className="text-[13px] font-semibold text-text dark:text-text-dark">Reject</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleApprove(item.id)}
                  disabled={busyId === item.id}
                  className="rounded-[10px] bg-accent px-3.5 py-2"
                >
                  <Text className="text-[13px] font-semibold text-white">{busyId === item.id ? 'Working…' : 'Approve'}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
