// Direct-Supabase equivalent of Inventra/lib/actions/approvals.ts.
//
// Deciding (approve/reject) pending requests is web-only — see
// Inventra/components/approvals/ApprovalsClient.tsx — since approval_requests
// is shared across both apps against the same Supabase backend. Cancelling
// your own still-pending request stays here for pending-approval-wait.tsx.
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function cancelApprovalRequest(requestId: string): Promise<void> {
  const profile = await requireProfile();
  const { error } = await supabase.from('approval_requests').update({ status: 'cancelled' }).eq('id', requestId).eq('requested_by', profile.id);
  if (error) throw new Error('Could not cancel this request.');
}
