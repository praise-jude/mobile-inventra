import { logError } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/database';

export interface AuditLogInput {
  orgId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  newValue?: Record<string, unknown> | null;
}

// Mirrors Inventra/lib/actions/audit.ts's logAudit — fire-and-forget, must
// never throw or block the mutation it's describing. Mobile has no
// server-side `headers()` for IP/device, so those columns are simply left
// off rather than filled with a spoofable client-reported value.
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      org_id: input.orgId,
      actor_id: input.actorId,
      actor_name: input.actorName,
      actor_role: input.actorRole,
      action: input.action,
      module: input.module,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      new_value: input.newValue ?? null,
    });
    if (error) logError({ feature: 'Audit', action: 'logAudit' }, 'audit_logs insert failed', error, { orgId: input.orgId, auditAction: input.action });
  } catch (err) {
    logError({ feature: 'Audit', action: 'logAudit' }, 'logAudit threw', err, { orgId: input.orgId, auditAction: input.action });
  }
}

// Mirrors Inventra/lib/actions/audit.ts's recordLogin — called after a
// successful sign-in (src/app/(auth)/login.tsx). Web already tracked this;
// mobile logins were previously invisible in the audit trail.
export async function recordLogin(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, first_name, last_name, role')
      .eq('id', user.id)
      .single();
    if (!profile) return;

    await logAudit({
      orgId: profile.org_id,
      actorId: user.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: 'user.login',
      module: 'Auth',
      entityType: 'profile',
      entityId: user.id,
      entityLabel: `${profile.first_name} ${profile.last_name}`,
    });
  } catch (err) {
    logError({ feature: 'Auth', action: 'recordLogin' }, 'recordLogin failed', err);
  }
}

// Mirrors Inventra/lib/actions/audit.ts's recordLogout — must run before
// supabase.auth.signOut() tears down the session, while it's still valid
// enough to attribute the entry to the right user.
export async function recordLogout(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, first_name, last_name, role')
      .eq('id', user.id)
      .single();
    if (!profile) return;

    await logAudit({
      orgId: profile.org_id,
      actorId: user.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: 'user.logout',
      module: 'Auth',
      entityType: 'profile',
      entityId: user.id,
      entityLabel: `${profile.first_name} ${profile.last_name}`,
    });
  } catch (err) {
    logError({ feature: 'Auth', action: 'recordLogout' }, 'recordLogout failed', err);
  }
}
