// Direct-Supabase equivalents of Inventra/lib/actions/team.ts's Server
// Actions, for the RLS-scoped writes (role changes, suspend/reactivate,
// approve/reject) — see products.ts's header comment for why those don't
// need a bearer-token route. invite/resendInvite/removeMember are the
// exception: they touch Supabase's Admin API (auth.users), which needs the
// service-role key a mobile bundle can never hold, so those three call the
// dedicated app/api/mobile/team/* routes instead (same pattern as
// actions/billing.ts's postToMobileBillingRoute).
import { logAudit } from '@/lib/actions/audit';
import { createNotification } from '@/lib/actions/notifications';
import { isAdminRole, isManagerRole } from '@/lib/roles';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export const REJECT_REASONS = ['Wrong branch', 'Duplicate account', 'Invalid invitation', 'Other'] as const;

function requireAdminRole(profile: Profile) {
  if (!isAdminRole(profile.role)) {
    throw new Error('Only an owner or admin can manage team members.');
  }
}

// Approve/reject also accept Manager-tier callers — mirrors
// Inventra/lib/actions/team.ts's requireAdminOrManagerOrgId(). RLS
// (guard_profile_status_transitions()) is the real enforcement boundary:
// a Manager can only ever touch a row that's currently awaiting_approval,
// regardless of what this check allows.
function requireAdminOrManagerRole(profile: Profile) {
  if (!isManagerRole(profile.role)) {
    throw new Error('Only an owner, admin, or manager can manage team members.');
  }
}

async function assertNotLastOwner(orgId: string, memberId: string) {
  const { data: member } = await supabase.from('profiles').select('role').eq('id', memberId).single();
  if (member?.role !== 'owner') return;
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'owner');
  if ((count ?? 0) <= 1) throw new Error("This is the only owner — promote another member to owner first.");
}

export async function updateMemberRole(memberId: string, role: string): Promise<void> {
  const profile = await requireProfile();
  requireAdminRole(profile);
  if (memberId === profile.id) throw new Error("You can't change your own role.");
  await assertNotLastOwner(profile.org_id, memberId);

  const { data: before } = await supabase.from('profiles').select('role, first_name, last_name').eq('id', memberId).maybeSingle();

  const { error } = await supabase.from('profiles').update({ role: role as Profile['role'] }).eq('id', memberId).eq('org_id', profile.org_id);
  if (error) throw new Error("Could not update this member's role.");

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'user.role_changed',
    module: 'Team',
    entityType: 'profile',
    entityId: memberId,
    entityLabel: before ? `${before.first_name} ${before.last_name}` : memberId,
    newValue: { role },
  });
}

export async function suspendMember(memberId: string): Promise<void> {
  const profile = await requireProfile();
  requireAdminRole(profile);
  if (memberId === profile.id) throw new Error("You can't suspend your own account.");
  await assertNotLastOwner(profile.org_id, memberId);

  const { data: member } = await supabase.from('profiles').select('first_name, last_name').eq('id', memberId).maybeSingle();

  const { error } = await supabase
    .from('profiles')
    .update({ suspended_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('org_id', profile.org_id);
  if (error) throw new Error('Could not suspend this member.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'user.suspended',
    module: 'Team',
    entityType: 'profile',
    entityId: memberId,
    entityLabel: member ? `${member.first_name} ${member.last_name}` : memberId,
  });
}

export async function reactivateMember(memberId: string): Promise<void> {
  const profile = await requireProfile();
  requireAdminRole(profile);

  const { data: member } = await supabase.from('profiles').select('first_name, last_name').eq('id', memberId).maybeSingle();

  const { error } = await supabase.from('profiles').update({ suspended_at: null }).eq('id', memberId).eq('org_id', profile.org_id);
  if (error) throw new Error('Could not reactivate this member.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'user.reactivated',
    module: 'Team',
    entityType: 'profile',
    entityId: memberId,
    entityLabel: member ? `${member.first_name} ${member.last_name}` : memberId,
  });
}

export async function approveMember(memberId: string): Promise<void> {
  const profile = await requireProfile();
  requireAdminOrManagerRole(profile);

  const { data: member } = await supabase
    .from('profiles')
    .select('org_id, first_name, last_name, status')
    .eq('id', memberId)
    .single();
  if (!member || member.org_id !== profile.org_id) throw new Error('Member not found.');
  if (member.status !== 'awaiting_approval') throw new Error("This member isn't awaiting approval.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'active', approved_by: profile.id, approved_at: now })
    .eq('id', memberId)
    .eq('org_id', profile.org_id);
  if (error) throw new Error('Could not approve this member.');

  const { data: org } = await supabase.from('organizations').select('name').eq('id', profile.org_id).single();
  void createNotification({
    orgId: profile.org_id,
    userId: memberId,
    type: 'member_approved',
    title: 'Your account has been approved',
    body: `You now have access to ${org?.name ?? 'your workspace'}.`,
    entityType: 'profile',
    entityId: memberId,
  });

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'user.approved',
    module: 'Team',
    entityType: 'profile',
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
    newValue: { approvedBy: profile.id, approvedAt: now },
  });
}

export async function rejectMember(memberId: string, reason: (typeof REJECT_REASONS)[number], detail?: string): Promise<void> {
  const profile = await requireProfile();
  requireAdminOrManagerRole(profile);

  const { data: member } = await supabase.from('profiles').select('org_id, first_name, last_name, status').eq('id', memberId).single();
  if (!member || member.org_id !== profile.org_id) throw new Error('Member not found.');
  if (member.status !== 'awaiting_approval') throw new Error("This member isn't awaiting approval.");

  const fullReason = reason === 'Other' && detail?.trim() ? detail.trim() : reason;
  const { error } = await supabase
    .from('profiles')
    .update({ rejected_at: new Date().toISOString(), rejected_reason: fullReason })
    .eq('id', memberId)
    .eq('org_id', profile.org_id);
  if (error) throw new Error('Could not reject this member.');

  void createNotification({
    orgId: profile.org_id,
    userId: memberId,
    type: 'member_rejected',
    title: 'Your account request was not approved',
    body: fullReason,
    entityType: 'profile',
    entityId: memberId,
  });

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'user.rejected',
    module: 'Team',
    entityType: 'profile',
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
    newValue: { reason: fullReason },
  });
}

// The three actions below need Supabase's Admin API (invite/delete
// auth.users rows) — the one thing this mobile bundle can never do itself.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function postToMobileTeamRoute(path: string, body?: unknown): Promise<unknown> {
  if (!API_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL — copy .env.example to .env and fill in the value.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/mobile/team/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const responseBody = await response.json();
  if (!response.ok) {
    throw new Error(responseBody.error ?? 'Something went wrong.');
  }
  return responseBody;
}

export interface InviteMemberInput {
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  branchId: string;
}

export async function inviteMember(input: InviteMemberInput): Promise<void> {
  await postToMobileTeamRoute('invite', input);
}

export async function resendInvite(memberId: string): Promise<void> {
  await postToMobileTeamRoute('resend-invite', { memberId });
}

export async function removeMember(memberId: string): Promise<void> {
  await postToMobileTeamRoute('remove', { memberId });
}
