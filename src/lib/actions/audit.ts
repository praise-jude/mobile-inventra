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
    if (error) console.error('[Royal Inventra] logAudit insert failed:', error);
  } catch (err) {
    console.error('[Royal Inventra] logAudit failed:', err);
  }
}
