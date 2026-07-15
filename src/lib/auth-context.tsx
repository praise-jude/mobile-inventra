import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { AccessGateState } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  initializing: boolean;
  gate: AccessGateState | null;
  gateLoading: boolean;
  // Mirrors the needsOnboarding derivation in
  // Inventra/lib/supabase/middleware.ts: no profile yet, terms not
  // accepted, or (once both of those pass) no country on the org.
  needsOnboarding: boolean;
  // Mirrors middleware's awaitingCard: a fresh trial with no card on file
  // yet (trial_ends_at is only set once the Paystack webhook confirms
  // tokenization). Only meaningful once needsOnboarding is false — the
  // subscription/billing gate is a separate, later tier from profile
  // onboarding. Web's further "blocked" tier (expired/past_due/etc. for
  // *returning* users) isn't wired into mobile routing yet — that's a
  // separate follow-up, not needed to unblock first-time onboarding.
  awaitingCard: boolean;
  refetchGate: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      queryClient.invalidateQueries({ queryKey: ['access-gate'] });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const gateQuery = useQuery({
    queryKey: ['access-gate', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_access_gate_state');
      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  const gate = gateQuery.data ?? null;
  let needsOnboarding = false;
  if (session) {
    needsOnboarding = !gate?.profile_exists || !gate?.terms_accepted;
    if (gate?.profile_exists && gate.terms_accepted) {
      needsOnboarding = !gate.country;
    }
  }
  const awaitingCard = gate?.subscription_status === 'trialing' && !gate.trial_ends_at;

  return (
    <AuthContext.Provider
      value={{
        session,
        initializing,
        gate,
        gateLoading: gateQuery.isLoading,
        needsOnboarding,
        awaitingCard,
        refetchGate: () => void gateQuery.refetch(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
