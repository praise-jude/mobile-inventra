import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { touchLastSeen } from '@/lib/actions/presence';
import { supabase } from '@/lib/supabase';

const HEARTBEAT_MS = 45 * 1000;

export type PresenceStatus = 'online' | 'idle';

export interface PresenceUser {
  userId: string;
  name: string;
  role: string;
  status: PresenceStatus;
  since: string;
}

interface PresenceContextValue {
  online: PresenceUser[];
}

const PresenceContext = createContext<PresenceContextValue>({ online: [] });

export function usePresence() {
  return useContext(PresenceContext);
}

// Mirrors Inventra/components/app/PresenceProvider.tsx's Supabase Realtime
// presence channel — same channel name/shape (`presence:org:${orgId}`, same
// tracked payload) so a web session and a mobile session in the same org
// show up in each other's "who's online" list. Idle detection has no RN
// equivalent of web's mousemove/keydown/scroll listeners (there's no
// app-wide touch-activity signal to hook without wrapping every screen), so
// AppState foreground/background is the whole signal here: backgrounding
// the app counts as idle, foregrounding it re-tracks online.
export function PresenceProvider({
  userId,
  orgId,
  name,
  role,
  children,
}: PropsWithChildren<{ userId: string; orgId: string; name: string; role: string }>) {
  const [online, setOnline] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`presence:org:${orgId}`, {
      config: { presence: { key: userId } },
    });

    function track(status: PresenceStatus) {
      channel.track({ userId, name, role, status, since: new Date().toISOString() });
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users = Object.values(state)
          .map((entries) => entries[0])
          .filter((u): u is PresenceUser & { presence_ref: string } => !!u);
        setOnline(users);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') track('online');
      });

    void touchLastSeen();
    const heartbeat = setInterval(() => void touchLastSeen(), HEARTBEAT_MS);

    function onAppStateChange(state: AppStateStatus) {
      track(state === 'active' ? 'online' : 'idle');
    }
    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      clearInterval(heartbeat);
      subscription.remove();
      void supabase.removeChannel(channel);
    };
  }, [userId, orgId, name, role]);

  return <PresenceContext.Provider value={{ online }}>{children}</PresenceContext.Provider>;
}
