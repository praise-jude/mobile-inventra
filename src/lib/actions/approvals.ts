// Direct-Supabase equivalent of Inventra/lib/actions/approvals.ts.
//
// approval_requests is shared across both apps against the same Supabase
// backend — mobile only creates requests (see lib/approval-service.ts) and
// lets the requester cancel their own pending one; deciding a request
// (approve/reject) is web-only (app/(app)/approvals on Inventra), so
// listPendingApprovals/decideApprovalRequest were removed from here along
// with mobile's own inbox screen.
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function cancelApprovalRequest(requestId: string): Promise<void> {
  const profile = await requireProfile();
  const { error } = await supabase.from('approval_requests').update({ status: 'cancelled' }).eq('id', requestId).eq('requested_by', profile.id);
  if (error) throw new Error('Could not cancel this request.');
}
