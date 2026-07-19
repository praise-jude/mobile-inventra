import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { NotificationRow } from '@/types/database';

// Realtime (postgres_changes on notifications, filtered to this user) so a
// notification created by another session — e.g. an Admin approving
// someone from the web app — shows up here immediately, mirroring
// Inventra/components/notifications/NotificationsClient.tsx's channel.
export function useNotifications() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', session?.user.id],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw new Error('Could not load notifications.');
      return data ?? [];
    },
    enabled: !!session,
  });

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`notifications:user:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session, queryClient]);

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  };
}
