import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface OrgContext {
  orgId: string;
  currency: string;
  taxRate: number;
}

// Small, cached lookup backing useOrgId/useOrgCurrency/useOrgTaxRate, so
// every Inventory/Sales screen that needs "which org am I in", "what
// currency does it use", or "what's the tax rate" shares one query instead
// of each re-deriving it — unlike billing, which is genuinely NGN-only
// since that's the only currency Paystack is wired for here.
function useOrgContext() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['org-context', session?.user.id],
    queryFn: async (): Promise<OrgContext> => {
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', session!.user.id).single();
      if (!profile) throw new Error('No profile');
      const { data: org } = await supabase.from('organizations').select('currency, tax_rate').eq('id', profile.org_id).single();
      return { orgId: profile.org_id, currency: org?.currency ?? 'USD', taxRate: Number(org?.tax_rate ?? 0) };
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 60,
  });
}

export function useOrgCurrency(): string {
  return useOrgContext().data?.currency ?? 'USD';
}

export function useOrgId(): string | null {
  return useOrgContext().data?.orgId ?? null;
}

export function useOrgTaxRate(): number {
  return useOrgContext().data?.taxRate ?? 0;
}
