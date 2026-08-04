// Direct-Supabase + bearer-token-route equivalent of
// Inventra/lib/actions/branch-staff.ts. Branch Staff is the branch-scoped
// replacement for the old Team Management invite flow (removed in favor
// of branch-code self-service signup — see
// Inventra/supabase/migrations/20260803200000_branch_code_signup.sql,
// which only ever creates Manager accounts). This restores just enough of
// the old flow for a Manager to bring Cashier/Warehouse staff onto their
// OWN branch.
//
// Scope note: unlike web, mobile doesn't expose resend-invite or
// remove-member — both are Admin-only, rarer actions better done from the
// fuller Branches admin page on web. Invite/approve/reject (the flows a
// Manager actually needs day-to-day) work fully here.
import { logAudit } from '@/lib/actions/audit';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface InviteBranchStaffInput {
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  branchId: string;
}

// Needs the service-role key (inviteUserByEmail) for the actual invite
// send, which mobile can never hold — goes through the bearer-token web
// route instead, same pattern as billing.ts/invoices.ts.
export async function inviteBranchStaff(input: InviteBranchStaffInput): Promise<void> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL — copy .env.example to .env and fill in the value.');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/mobile/branch-staff/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'Could not send the invite.');
}

// approveBranchStaff/rejectBranchStaff are plain RLS-scoped table writes —
// guard_profile_status_transitions() and profiles_update_manager_approval
// already enforce who can touch an awaiting_approval row (any Admin/Owner,
// or a Manager whose own branch_id matches the invitee's), so these need
// no server hop, same as approvals.ts's cancelApprovalRequest.
export async function approveBranchStaff(memberId: string): Promise<void> {
  const profile = await requireProfile();
  const { data: member } = await supabase.from('profiles').select('org_id, first_name, last_name, status').eq('id', memberId).single();
  if (!member || member.org_id !== profile.org_id) throw new Error('Member not found.');
  if (member.status !== 'awaiting_approval') throw new Error("This member isn't awaiting approval.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'active', approved_by: profile.id, approved_at: now })
    .eq('id', memberId)
    .eq('org_id', profile.org_id);
  if (error) throw new Error('Could not approve this member — you may only approve staff in your own branch.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'user.approved',
    module: 'Branch Staff',
    entityType: 'profile',
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
    newValue: { approvedBy: profile.id, approvedAt: now },
  });
}

export async function rejectBranchStaff(memberId: string, reason?: string): Promise<void> {
  const profile = await requireProfile();
  const { data: member } = await supabase.from('profiles').select('org_id, first_name, last_name, status').eq('id', memberId).single();
  if (!member || member.org_id !== profile.org_id) throw new Error('Member not found.');
  if (member.status !== 'awaiting_approval') throw new Error("This member isn't awaiting approval.");

  const fullReason = reason?.trim() || 'Not approved';
  const { error } = await supabase
    .from('profiles')
    .update({ rejected_at: new Date().toISOString(), rejected_reason: fullReason })
    .eq('id', memberId)
    .eq('org_id', profile.org_id);
  if (error) throw new Error('Could not reject this member — you may only decide staff in your own branch.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'user.rejected',
    module: 'Branch Staff',
    entityType: 'profile',
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
    newValue: { reason: fullReason },
  });
}
