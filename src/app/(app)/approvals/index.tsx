import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { decideApprovalRequest } from '@/lib/actions/approvals';
import { PlaceholderTextColor } from '@/constants/theme';
import { notifyAlert } from '@/lib/confirm';
import { FLATLIST_PERF_PROPS } from '@/lib/flatlist-perf';
import { formatMoney, timeAgo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { usePendingApprovals, type PendingApprovalRow } from '@/lib/hooks/use-approvals';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useOrgCurrency } from '@/lib/hooks/use-org';
import { isManagerRole } from '@/lib/roles';

const ENTITY_ICON: Record<string, string> = { discount: '🏷️', void_sale: '🗑️', price_change: '💲' };
const ENTITY_LABEL: Record<string, string> = { discount: 'Discount', void_sale: 'Void sale', price_change: 'Price change' };

// Mirrors Inventra/components/approvals/ApprovalsClient.tsx — same three
// entity types, same summarize() logic, same "apply the change under the
// original requester's attribution" backend (lib/actions/approvals.ts).
// Reject uses an inline expanding reason field instead of window.prompt
// (not available/idiomatic in React Native).
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

export default function ApprovalsScreen() {
  const profileQuery = useMyProfile();
  const isManager = isManagerRole(profileQuery.data?.role ?? '');
  const currency = useOrgCurrency();
  const query = usePendingApprovals();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await decideApprovalRequest(id, 'approved');
      haptics.success();
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not approve this request.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await decideApprovalRequest(id, 'rejected', rejectReason.trim() || undefined);
      haptics.success();
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not reject this request.');
    } finally {
      setBusyId(null);
    }
  }

  if (profileQuery.data && !isManager) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark px-8">
        <Text className="text-center text-[13.5px] text-muted dark:text-muted-dark">Only a manager, admin, or owner can review approval requests.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Approvals</Text>
        <View className="w-12" />
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(r) => r.id}
          {...FLATLIST_PERF_PROPS}
          contentContainerClassName="gap-2.5 p-4 pb-6"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          ListEmptyComponent={
            <EmptyState icon="✅" title="No pending approvals" description="Discount, void, and price-change requests will show up here." />
          }
          renderItem={({ item }) => {
            const isBusy = busyId === item.id;
            const isRejecting = rejectingId === item.id;
            return (
              <View className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                <View className="flex-row items-center gap-2.5">
                  <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                    <Text className="text-[16px]">{ENTITY_ICON[item.entityType] ?? '❓'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13.5px] font-bold text-text dark:text-text-dark">{ENTITY_LABEL[item.entityType] ?? item.entityType}</Text>
                    <Text className="text-[11.5px] text-text-2 dark:text-text-2-dark">
                      {item.requestedByName} · {timeAgo(item.requestedAt)}
                    </Text>
                  </View>
                </View>
                <Text className="mt-2.5 text-[12.5px] text-text dark:text-text-dark">{summarize(item, currency)}</Text>
                {item.reason && (
                  <View className="mt-2 rounded-[9px] bg-hover px-3 py-2 dark:bg-hover-dark">
                    <Text className="text-[11.5px] text-text-2 dark:text-text-2-dark">Note: {item.reason}</Text>
                  </View>
                )}

                {isRejecting ? (
                  <View className="mt-3 gap-2">
                    <TextInput
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      placeholder="Reason for rejecting (optional)"
                      placeholderTextColor={PlaceholderTextColor}
                      className="h-[38px] rounded-[8px] border border-border bg-surface px-2.5 text-[12.5px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                    />
                    <View className="flex-row gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onPress={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button loading={isBusy} className="flex-1" onPress={() => handleReject(item.id)}>
                        Confirm reject
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View className="mt-3 flex-row justify-end gap-2.5">
                    <Button variant="secondary" disabled={isBusy} onPress={() => setRejectingId(item.id)}>
                      Reject
                    </Button>
                    <Button loading={isBusy} onPress={() => handleApprove(item.id)}>
                      Approve
                    </Button>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
