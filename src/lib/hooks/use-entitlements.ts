import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { getEntitlements } from '@/lib/entitlements';

// UI-facing cache over lib/entitlements.ts's getEntitlements() — used by
// the Dashboard banner, Settings > Subscription usage screen, and Premium
// badges (Phase F7). Actions/screens that need a one-shot check before a
// write should call the plain async can*() functions directly instead;
// this hook is for rendering, not for gating a mutation.
export function useEntitlements() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['entitlements', session?.user.id],
    queryFn: getEntitlements,
    enabled: !!session,
    staleTime: 1000 * 30,
  });
}
