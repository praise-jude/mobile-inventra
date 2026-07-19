import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { REJECT_REASONS, approveMember, reactivateMember, rejectMember, removeMember, resendInvite, suspendMember, updateMemberRole } from '@/lib/actions/team';
import { useAuth } from '@/lib/auth-context';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import { useTeamMembers, type TeamMemberRow } from '@/lib/hooks/use-team';

// Mirrors Inventra/components/team/TeamClient.tsx — a bottom-sheet Modal
// stands in for the web dropdown menu, and Alert.alert stands in for
// window.confirm, but the underlying action set and status logic is
// identical (see displayStatus below, ported line-for-line).
const ASSIGNABLE_ROLES = ['admin', 'manager', 'cashier', 'warehouse'];

const ROLE_STYLE: Record<string, string> = {
  owner: 'text-accent-text dark:text-accent-text-dark bg-accent-weak dark:bg-accent-weak-dark',
  admin: 'text-text-2 dark:text-text-2-dark bg-hover dark:bg-hover-dark',
  manager: 'text-green dark:text-green-dark bg-green-weak dark:bg-green-weak-dark',
  cashier: 'text-amber dark:text-amber-dark bg-amber-weak dark:bg-amber-weak-dark',
  warehouse: 'text-sky dark:text-sky-dark bg-sky-weak dark:bg-sky-weak-dark',
};

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  invited: { label: 'Invited', className: 'text-amber dark:text-amber-dark bg-amber-weak dark:bg-amber-weak-dark' },
  awaiting_approval: { label: 'Awaiting approval', className: 'text-sky dark:text-sky-dark bg-sky-weak dark:bg-sky-weak-dark' },
  active: { label: 'Approved', className: 'text-green dark:text-green-dark bg-green-weak dark:bg-green-weak-dark' },
  rejected: { label: 'Rejected', className: 'text-red dark:text-red-dark bg-red-weak dark:bg-red-weak-dark' },
  suspended: { label: 'Suspended', className: 'text-muted dark:text-muted-dark bg-hover dark:bg-hover-dark' },
};

const FILTERS = [
  ['all', 'Total'],
  ['invited', 'Invited'],
  ['awaiting_approval', 'Awaiting'],
  ['active', 'Approved'],
  ['suspended', 'Suspended'],
  ['rejected', 'Rejected'],
] as const;

type StatusFilter = (typeof FILTERS)[number][0];

function displayStatus(m: TeamMemberRow): 'invited' | 'awaiting_approval' | 'active' | 'suspended' | 'rejected' {
  if (m.rejectedAt) return 'rejected';
  if (m.suspendedAt) return 'suspended';
  return m.status as 'invited' | 'awaiting_approval' | 'active';
}

export default function TeamScreen() {
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const query = useTeamMembers();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [target, setTarget] = useState<TeamMemberRow | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const members = query.data ?? [];
  const filtered = useMemo(() => {
    const rows = query.data ?? [];
    let result = statusFilter === 'all' ? rows : rows.filter((m) => displayStatus(m) === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || (m.branchName ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [query.data, statusFilter, search]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
      haptics.success();
      await query.invalidate();
      setTarget(null);
      setRejecting(false);
    } catch (err) {
      notifyAlert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDestructive = (title: string, message: string, onConfirm: () => void) => {
    confirmAlert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Team</Text>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push('/team/invite');
          }}
          hitSlop={10}
        >
          <Text className="text-[20px] font-semibold text-accent-text dark:text-accent-text-dark">+</Text>
        </Pressable>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <>
          <View className="gap-3 px-4 pt-3">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, email, role…"
              placeholderTextColor="#aab2c4"
              className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={FILTERS}
              keyExtractor={([key]) => key}
              contentContainerClassName="gap-2"
              renderItem={({ item: [key, label] }) => {
                const count = key === 'all' ? members.length : members.filter((m) => displayStatus(m) === key).length;
                const active = statusFilter === key;
                return (
                  <Pressable
                    onPress={() => {
                      haptics.select();
                      setStatusFilter(key);
                    }}
                    className={`rounded-full border px-3 py-1.5 ${active ? 'border-accent bg-accent-weak dark:border-accent-dark dark:bg-accent-weak-dark' : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'}`}
                  >
                    <Text className={`text-[12px] font-semibold ${active ? 'text-accent-text dark:text-accent-text-dark' : 'text-text-2 dark:text-text-2-dark'}`}>
                      {label} · {count}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(m) => m.id}
            contentContainerClassName="gap-2.5 p-4 pb-10"
            ListEmptyComponent={<EmptyState icon="👥" title="No members found" description="Try a different search or filter." />}
            renderItem={({ item: m }) => {
              const status = displayStatus(m);
              const isSelf = m.id === currentUserId;
              const isBusy = busyId === m.id;
              const actionable = !isSelf && m.role !== 'owner';
              return (
                <Pressable
                  onPress={() => actionable && setTarget(m)}
                  disabled={!actionable || isBusy}
                  className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                      <Text className="text-[12.5px] font-bold text-accent-text dark:text-accent-text-dark">{m.initials}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark" numberOfLines={1}>
                        {m.name} {isSelf && <Text className="text-muted dark:text-muted-dark">(you)</Text>}
                      </Text>
                      <Text className="text-[11.5px] text-muted dark:text-muted-dark" numberOfLines={1}>
                        {m.email}
                      </Text>
                    </View>
                    {isBusy ? (
                      <ActivityIndicator />
                    ) : (
                      <View className={`rounded-full px-2.5 py-1 ${STATUS_STYLE[status].className}`}>
                        <Text className={`text-[10.5px] font-bold ${STATUS_STYLE[status].className}`}>{STATUS_STYLE[status].label}</Text>
                      </View>
                    )}
                  </View>
                  <View className="mt-2.5 flex-row items-center gap-2">
                    <View className={`rounded-full px-2 py-0.5 ${ROLE_STYLE[m.role] ?? ''}`}>
                      <Text className={`text-[10.5px] font-bold capitalize ${ROLE_STYLE[m.role] ?? ''}`}>{m.role}</Text>
                    </View>
                    <Text className="text-[11.5px] text-text-2 dark:text-text-2-dark">{m.branchName ?? 'No branch'}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        </>
      )}

      {target && (
        <MemberActionsSheet
          member={target}
          rejecting={rejecting}
          busy={busyId === target.id}
          onClose={() => {
            setTarget(null);
            setRejecting(false);
          }}
          onRoleChange={(role) => run(target.id, () => updateMemberRole(target.id, role))}
          onResendInvite={() => run(target.id, () => resendInvite(target.id))}
          onApprove={() => run(target.id, () => approveMember(target.id))}
          onStartReject={() => setRejecting(true)}
          onReject={(reason, detail) => run(target.id, () => rejectMember(target.id, reason, detail))}
          onSuspend={() =>
            confirmDestructive(`Suspend ${target.name}?`, "They won't be able to sign in until reactivated.", () => run(target.id, () => suspendMember(target.id)))
          }
          onReactivate={() => run(target.id, () => reactivateMember(target.id))}
          onRemove={() =>
            confirmDestructive(`Remove ${target.name}?`, "This can't be undone.", () => run(target.id, () => removeMember(target.id)))
          }
        />
      )}
    </SafeAreaView>
  );
}

function MemberActionsSheet({
  member,
  rejecting,
  busy,
  onClose,
  onRoleChange,
  onResendInvite,
  onApprove,
  onStartReject,
  onReject,
  onSuspend,
  onReactivate,
  onRemove,
}: {
  member: TeamMemberRow;
  rejecting: boolean;
  busy: boolean;
  onClose: () => void;
  onRoleChange: (role: string) => void;
  onResendInvite: () => void;
  onApprove: () => void;
  onStartReject: () => void;
  onReject: (reason: (typeof REJECT_REASONS)[number], detail?: string) => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onRemove: () => void;
}) {
  const status = displayStatus(member);
  const [detail, setDetail] = useState('');

  return (
    <Pressable onPress={onClose} className="absolute inset-0 items-end justify-end bg-black/40">
      <Pressable onPress={(e) => e.stopPropagation()} className="w-full rounded-t-[20px] bg-surface p-5 pb-8 dark:bg-surface-dark">
        <Text className="text-[15px] font-bold text-text dark:text-text-dark">{member.name}</Text>
        <Text className="mb-4 text-[12px] text-muted dark:text-muted-dark">{member.email}</Text>

        {rejecting ? (
          <View className="gap-2.5">
            <Text className="text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Reason for rejecting</Text>
            {REJECT_REASONS.map((reason) => (
              <Button key={reason} variant="secondary" loading={busy} onPress={() => onReject(reason, reason === 'Other' ? detail : undefined)}>
                {reason}
              </Button>
            ))}
            <TextInput
              value={detail}
              onChangeText={setDetail}
              placeholder='Details (only used for "Other")'
              placeholderTextColor="#aab2c4"
              className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
          </View>
        ) : (
          <View className="gap-2.5">
            {status === 'active' && (
              <SelectField
                label="Role"
                value={member.role}
                options={ASSIGNABLE_ROLES.map((r) => ({ label: r[0].toUpperCase() + r.slice(1), value: r }))}
                onChange={onRoleChange}
              />
            )}
            {status === 'invited' && (
              <Button variant="secondary" loading={busy} onPress={onResendInvite}>
                Resend invite
              </Button>
            )}
            {status === 'awaiting_approval' && (
              <>
                <Button loading={busy} onPress={onApprove}>
                  ✅ Approve
                </Button>
                <Button variant="secondary" onPress={onStartReject}>
                  ❌ Reject
                </Button>
              </>
            )}
            {status === 'suspended' && (
              <Button variant="secondary" loading={busy} onPress={onReactivate}>
                Reactivate
              </Button>
            )}
            {status === 'active' && (
              <Button variant="secondary" loading={busy} onPress={onSuspend}>
                Suspend
              </Button>
            )}
            <Button variant="secondary" loading={busy} onPress={onRemove} className="border-red dark:border-red-dark">
              <Text className="text-[14px] font-semibold text-red dark:text-red-dark">Remove</Text>
            </Button>
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
          </View>
        )}
      </Pressable>
    </Pressable>
  );
}
