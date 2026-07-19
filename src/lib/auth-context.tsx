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
  aalLoading: boolean;
  // Mirrors Inventra/lib/supabase/middleware.ts's needsMfaStepUp check,
  // which runs before every other gate: password auth alone sets a valid
  // (AAL1) session immediately, so without this a user with MFA enabled
  // could reach (app) without ever entering their second factor — this is
  // the highest-priority gate for exactly that reason (see _layout.tsx).
  // Web enforces this server-side on every navigation (middleware); mobile
  // has no server hop to do that in, so this client-side check is the only
  // enforcement boundary here — same trust model as every other gate in
  // this file already has (session-derived, re-checked on every auth
  // change via onAuthStateChange's invalidateQueries below).
  needsMfaStepUp: boolean;
  // Mirrors the needsOnboarding derivation in
  // Inventra/lib/supabase/middleware.ts: no profile yet, terms not
  // accepted, or (once both of those pass) no country on the org.
  needsOnboarding: boolean;
  // Mirrors middleware's awaitingCard: a fresh trial with no card on file
  // yet (trial_ends_at is only set once the Paystack webhook confirms
  // tokenization). Only meaningful once needsOnboarding is false — the
  // subscription/billing gate is a separate, later tier from profile
  // onboarding.
  awaitingCard: boolean;
  // Mirrors web's app/pending-approval/page.tsx redirect: a Manager-invited
  // member who's accepted their invite but hasn't been approved yet (see
  // guard_profile_status_transitions() — an Admin-invited member skips this
  // and lands straight in 'active'). Only meaningful once needsOnboarding
  // and awaitingCard are both false.
  awaitingApproval: boolean;
  // Mirrors middleware's BLOCKED_STATUSES + trialExpired check: a returning
  // user whose trial ran out or whose subscription lapsed (past_due,
  // payment_failed, cancelled, expired, suspended). Only meaningful once
  // needsOnboarding, awaitingCard, and awaitingApproval are all false.
  blocked: boolean;
  refetchGate: () => void;
  refetchAal: () => void;
}

const BLOCKED_STATUSES = ['past_due', 'payment_failed', 'cancelled', 'expired', 'suspended'];

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
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      queryClient.invalidateQueries({ queryKey: ['access-gate'] });
      queryClient.invalidateQueries({ queryKey: ['mfa-aal'] });
      // Most query keys in this app (products, sales, inventory, reports,
      // etc.) aren't scoped by org/user id — on a shared device, a second
      // person signing in right after a sign-out would otherwise briefly
      // see the previous session's cached prices/products/sale totals
      // until each query refetches on its own.
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      }
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

  const aalQuery = useQuery({
    queryKey: ['mfa-aal', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  const aal = aalQuery.data ?? null;
  const needsMfaStepUp = !!session && aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel;

  const gate = gateQuery.data ?? null;
  let needsOnboarding = false;
  if (session) {
    needsOnboarding = !gate?.profile_exists || !gate?.terms_accepted;
    if (gate?.profile_exists && gate.terms_accepted) {
      needsOnboarding = !gate.country;
    }
  }
  const awaitingCard = gate?.subscription_status === 'trialing' && !gate.trial_ends_at;
  const awaitingApproval = !!session && !needsMfaStepUp && !needsOnboarding && !awaitingCard && gate?.member_status === 'awaiting_approval';

  let blocked = false;
  if (session && !needsMfaStepUp && !needsOnboarding && !awaitingCard && !awaitingApproval) {
    const trialExpired =
      gate?.subscription_status === 'trialing' && !!gate.trial_ends_at && new Date(gate.trial_ends_at) < new Date();
    blocked = trialExpired || (!!gate?.subscription_status && BLOCKED_STATUSES.includes(gate.subscription_status));
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        initializing,
        gate,
        gateLoading: gateQuery.isLoading,
        aalLoading: aalQuery.isLoading,
        needsMfaStepUp,
        needsOnboarding,
        awaitingCard,
        awaitingApproval,
        blocked,
        refetchGate: () => void gateQuery.refetch(),
        refetchAal: () => void aalQuery.refetch(),
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
