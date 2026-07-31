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

  // Depend on the user id (a stable primitive), not `session` itself — see
  // use-team.ts's identical fix for why: the session object gets a new
  // reference on every auth event (token refresh included), which was
  // re-running this effect far more often than the user actually
  // changed, recreating a same-named channel before the previous one's
  // async removeChannel() had finished tearing down. Supabase surfaces
  // that as "cannot add postgres_changes callbacks... after subscribe()".
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  };
}
