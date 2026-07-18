import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

// Small, cached lookup so every Inventory/Sales money display formats in the
// org's actual configured currency (set during onboarding via
// currencyForCountry) instead of a hardcoded NGN — unlike billing, which is
// genuinely NGN-only since that's the only currency Paystack is wired for
// here.
export function useOrgCurrency(): string {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['org-currency', session?.user.id],
    queryFn: async () => {
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', session!.user.id).single();
      if (!profile) return 'USD';
      const { data: org } = await supabase.from('organizations').select('currency').eq('id', profile.org_id).single();
      return org?.currency ?? 'USD';
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 60,
  });
  return query.data ?? 'USD';
}
