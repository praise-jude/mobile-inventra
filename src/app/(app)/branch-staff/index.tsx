import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { approveBranchStaff, rejectBranchStaff } from '@/lib/actions/branch-staff';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import { useBranchStaff, type BranchStaffRow } from '@/lib/hooks/use-branch-staff';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useWarehousesOverview } from '@/lib/hooks/use-warehouses';
import { isAdminRole } from '@/lib/roles';

const ROLE_LABEL: Record<string, string> = { manager: 'Manager', cashier: 'Cashier', warehouse: 'Warehouse' };
const STATUS_LABEL: Record<string, string> = { invited: 'Invited', awaiting_approval: 'Awaiting approval', active: 'Active' };

// Mirrors Inventra/app/(app)/branch-staff/page.tsx (Manager's own-branch
// view) and, for Admin/Owner, the Staff section on
// Inventra/app/(app)/settings/branches — one screen covers both since
// mobile has no per-branch card grid to embed into. useBranchStaff()
// already scopes non-admin callers to their own branch server-side.
export default function BranchStaffScreen() {
  const queryClient = useQueryClient();
  const profileQuery = useMyProfile();
  const staffQuery = useBranchStaff();
  const warehousesQuery = useWarehousesOverview();
  const isAdmin = isAdminRole(profileQuery.data?.role ?? '');
  const [busyId, setBusyId] = useState<string | null>(null);

  const warehouseNameById = useMemo(() => new Map((warehousesQuery.data ?? []).map((w) => [w.id, w.name])), [warehousesQuery.data]);

  const grouped = useMemo(() => {
    const rows = staffQuery.data ?? [];
    if (!isAdmin) return [{ branchId: profileQuery.data?.branch_id ?? null, rows }];
    const byBranch = new Map<string, BranchStaffRow[]>();
    for (const r of rows) {
      const key = r.branchId ?? 'unassigned';
      byBranch.set(key, [...(byBranch.get(key) ?? []), r]);
    }
    return Array.from(byBranch.entries()).map(([branchId, branchRows]) => ({ branchId: branchId === 'unassigned' ? null : branchId, rows: branchRows }));
  }, [staffQuery.data, isAdmin, profileQuery.data?.branch_id]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['branch-staff'] });
  }

  async function handleApprove(s: BranchStaffRow) {
    setBusyId(s.id);
    try {
      await approveBranchStaff(s.id);
      haptics.success();
      invalidate();
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not approve this member.');
    } finally {
      setBusyId(null);
    }
  }

  function handleReject(s: BranchStaffRow) {
    confirmAlert(`Reject ${s.firstName} ${s.lastName}?`, '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setBusyId(s.id);
          try {
            await rejectBranchStaff(s.id);
            haptics.success();
            invalidate();
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not reject this member.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  if (profileQuery.isLoading || staffQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="gap-2.5 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] w-full" />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (staffQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <ErrorState onRetry={() => staffQuery.refetch()} />
      </SafeAreaView>
    );
  }

  if (!isAdmin && !profileQuery.data?.branch_id) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
          </Pressable>
          <Text className="text-[16px] font-bold text-text dark:text-text-dark">Branch Staff</Text>
          <View className="w-12" />
        </View>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-[13px] text-muted dark:text-muted-dark">
            Ask an owner or admin to assign you to a branch before inviting staff.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Branch Staff</Text>
        <View className="w-12" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-4">
        <Button onPress={() => router.push('/branch-staff/invite')} className="self-start px-4">
          + Invite staff
        </Button>

        {grouped.every((g) => g.rows.length === 0) ? (
          <EmptyState icon="🧑‍🤝‍🧑" title="No staff invited yet" description="Invite a Cashier or Warehouse teammate to your branch." />
        ) : (
          grouped.map((group) => (
            <View key={group.branchId ?? 'unassigned'} className="gap-2">
              {isAdmin && (
                <Text className="text-[12px] font-bold text-text dark:text-text-dark">
                  {group.branchId ? (warehouseNameById.get(group.branchId) ?? 'Unknown branch') : 'Unassigned'}
                </Text>
              )}
              {group.rows.map((s) => (
                <View key={s.id} className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-semibold text-text dark:text-text-dark">
                      {s.firstName} {s.lastName}
                    </Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark">{ROLE_LABEL[s.role] ?? s.role}</Text>
                  </View>
                  <Text className="mt-0.5 text-[11.5px] text-text-2 dark:text-text-2-dark">{s.email}</Text>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-[11px] text-muted dark:text-muted-dark">{STATUS_LABEL[s.status] ?? s.status}</Text>
                    {s.status === 'awaiting_approval' && (
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => handleApprove(s)}
                          disabled={busyId === s.id}
                          className="rounded-[8px] border border-border px-2.5 py-1 dark:border-border-dark"
                        >
                          <Text className="text-[11.5px] font-semibold text-green dark:text-green-dark">Approve</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleReject(s)}
                          disabled={busyId === s.id}
                          className="rounded-[8px] border border-border px-2.5 py-1 dark:border-border-dark"
                        >
                          <Text className="text-[11.5px] font-semibold text-red dark:text-red-dark">Reject</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
