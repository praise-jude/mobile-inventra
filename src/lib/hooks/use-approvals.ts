import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { listPendingApprovals, type PendingApprovalRow } from '@/lib/actions/approvals';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { supabase } from '@/lib/supabase';

export type { PendingApprovalRow };

// Mirrors Inventra/components/approvals/ApprovalsClient.tsx's realtime
// channel — unfiltered (RLS already scopes listPendingApprovals to this
// org), just triggers a refetch so a request created or decided on another
// device (including the web app, since approval_requests is shared) shows
// up here immediately.
export function usePendingApprovals() {
  const profileQuery = useMyProfile();
  const orgId = profileQuery.data?.org_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pending-approvals', orgId],
    queryFn: (): Promise<PendingApprovalRow[]> => listPendingApprovals(),
    enabled: !!orgId,
  });

  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`approval-requests:org:${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  return query;
}
