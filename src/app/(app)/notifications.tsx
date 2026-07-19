import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications';
import { haptics } from '@/lib/haptics';
import { useNotifications } from '@/lib/hooks/use-notifications';
import type { NotificationRow } from '@/types/database';

const TYPE_ICON: Record<string, string> = {
  member_approved: '✅',
  member_rejected: '❌',
  pending_approval: '⏳',
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

// Mirrors Inventra/components/notifications/NotificationsClient.tsx.
export default function NotificationsScreen() {
  const query = useNotifications();
  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function handleMarkRead(n: NotificationRow) {
    if (n.read_at) return;
    haptics.tap();
    await markNotificationRead(n.id);
    query.invalidate();
  }

  async function handleMarkAllRead() {
    haptics.tap();
    await markAllNotificationsRead();
    query.invalidate();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={handleMarkAllRead} hitSlop={10}>
            <Text className="text-[12.5px] font-semibold text-accent-text dark:text-accent-text-dark">Mark all read</Text>
          </Pressable>
        ) : (
          <View className="w-14" />
        )}
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerClassName="p-4"
          ListEmptyComponent={
            <EmptyState icon="🔔" title="No notifications yet" description="Approvals, rejections, and team activity will show up here." />
          }
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item: n }) => (
            <Pressable
              onPress={() => handleMarkRead(n)}
              className="flex-row items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
            >
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                <Text className="text-[16px]">{TYPE_ICON[n.type] ?? '🔔'}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-[13.5px] font-semibold text-text dark:text-text-dark">{n.title}</Text>
                  {!n.read_at && <View className="h-[7px] w-[7px] rounded-full bg-accent dark:bg-accent-dark" />}
                </View>
                {n.body && <Text className="mt-0.5 text-[12.5px] text-text-2 dark:text-text-2-dark">{n.body}</Text>}
                <Text className="mt-1 text-[11px] text-muted dark:text-muted-dark">{timeAgo(n.created_at)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
