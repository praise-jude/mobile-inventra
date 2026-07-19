import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { NotificationSettings, Organization, PrintSettings } from '@/types/database';

// Backs (app)/settings/general.tsx, notifications.tsx, printing.tsx — one
// query for the org + its two 1:1 settings tables, since all three screens
// need "my org's id" first anyway (via useMyProfile elsewhere) and these
// three rows are always fetched/invalidated together.
export function useOrgSettings() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['org-settings', session?.user.id],
    queryFn: async (): Promise<{ org: Organization; notifications: NotificationSettings; printing: PrintSettings }> => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', session!.user.id)
        .single();
      if (profileError || !profile) throw new Error('Could not load your profile.');

      const [orgRes, notifRes, printRes] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', profile.org_id).single(),
        supabase.from('notification_settings').select('*').eq('org_id', profile.org_id).single(),
        supabase.from('print_settings').select('*').eq('org_id', profile.org_id).single(),
      ]);
      if (orgRes.error || !orgRes.data) throw new Error('Could not load business settings.');
      if (notifRes.error || !notifRes.data) throw new Error('Could not load notification settings.');
      if (printRes.error || !printRes.data) throw new Error('Could not load print settings.');

      return { org: orgRes.data, notifications: notifRes.data, printing: printRes.data };
    },
    enabled: !!session,
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['org-settings'] }),
  };
}
