import { Text, View } from 'react-native';

import { usePresence } from '@/lib/presence-context';
import type { TeamMemberRow } from '@/lib/hooks/use-team';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  warehouse: 'Warehouse',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Mirrors Inventra/components/team/TeamPresenceCard.tsx — same online/
// offline split, same role-breakdown grouping for online members, same
// "last seen" list for offline ones, sharing the same Realtime presence
// channel via usePresence() (src/lib/presence-context.tsx) so web and
// mobile sessions in the same org see each other here.
export function TeamPresenceCard({ members }: { members: TeamMemberRow[] }) {
  const { online } = usePresence();
  const onlineIds = new Set(online.map((u) => u.userId));
  const activeMembers = members.filter((m) => m.status === 'active');
  const offline = activeMembers.filter((m) => !onlineIds.has(m.id));

  const onlineByRole = new Map<string, typeof online>();
  for (const u of online) {
    onlineByRole.set(u.role, [...(onlineByRole.get(u.role) ?? []), u]);
  }

  return (
    <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <View className="mb-3.5 flex-row items-center justify-between">
        <View>
          <Text className="text-[15px] font-bold text-text dark:text-text-dark">Team presence</Text>
          <Text className="text-[12px] text-muted dark:text-muted-dark">Who&apos;s active right now</Text>
        </View>
        <View className="flex-row gap-3.5">
          <View className="items-end">
            <Text className="font-mono text-[19px] font-bold text-green dark:text-green-dark">{online.length}</Text>
            <Text className="text-[11px] text-muted dark:text-muted-dark">online</Text>
          </View>
          <View className="items-end">
            <Text className="font-mono text-[19px] font-bold text-muted dark:text-muted-dark">{offline.length}</Text>
            <Text className="text-[11px] text-muted dark:text-muted-dark">offline</Text>
          </View>
        </View>
      </View>

      {online.length === 0 ? (
        <Text className="text-[12.5px] text-muted dark:text-muted-dark">Nobody else is online right now.</Text>
      ) : (
        <View className="gap-3">
          {[...onlineByRole.entries()].map(([role, users]) => (
            <View key={role}>
              <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted dark:text-muted-dark">
                {ROLE_LABEL[role] ?? role} · {users.length}
              </Text>
              <View className="gap-1.5">
                {users.map((u) => (
                  <View key={u.userId} className="flex-row items-center gap-2">
                    <View className={`h-[7px] w-[7px] rounded-full ${u.status === 'online' ? 'bg-green dark:bg-green-dark' : 'bg-amber dark:bg-amber-dark'}`} />
                    <Text className="flex-1 text-[12.5px] text-text dark:text-text-dark" numberOfLines={1}>
                      {u.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {offline.length > 0 && (
        <View className="mt-3.5 border-t border-border-2 pt-3 dark:border-border-2-dark">
          <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted dark:text-muted-dark">Last seen</Text>
          <View className="gap-1.5">
            {offline.slice(0, 5).map((m) => (
              <View key={m.id} className="flex-row items-center justify-between">
                <Text className="flex-1 text-[12.5px] text-text-2 dark:text-text-2-dark" numberOfLines={1}>
                  {m.name}
                </Text>
                <Text className="text-[12.5px] text-muted dark:text-muted-dark">{m.lastActive ? timeAgo(m.lastActive) : 'never'}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
