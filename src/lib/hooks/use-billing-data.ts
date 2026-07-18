import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

// Shared by (billing)/subscription-required.tsx (blocked orgs) and
// (app)/billing.tsx (active self-service tab) — same profile/org/
// subscription/invoices fetch either way, only the surrounding screen copy
// differs. Mirrors Inventra/lib/queries/billing.ts's getBillingData.
export function useBillingData() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['billing-data', session?.user.id],
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .single();
      if (profileError) throw profileError;

      const [orgRes, subRes, invRes] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', profile.org_id).single(),
        supabase.from('subscriptions').select('*').eq('org_id', profile.org_id).single(),
        supabase.from('invoices').select('*').eq('org_id', profile.org_id).order('issued_at', { ascending: false }),
      ]);
      if (orgRes.error) throw orgRes.error;
      if (subRes.error) throw subRes.error;
      if (invRes.error) throw invRes.error;

      return { profile, org: orgRes.data, subscription: subRes.data, invoices: invRes.data ?? [] };
    },
    enabled: !!session,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['billing-data'] });
  }

  return { ...query, invalidate };
}
