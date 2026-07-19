// Direct-Supabase equivalent of Inventra/lib/actions/roles.ts — role_permissions
// writes are Admin-tier only. role_permissions_write_admin RLS already
// enforces this at the database layer, but checking here first gives a
// clear error instead of a silent no-op.
import { logAudit } from '@/lib/actions/audit';
import type { CustomizableRole } from '@/lib/permissions';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';

function requireAdminRole(role: string) {
  if (!['owner', 'admin'].includes(role)) {
    throw new Error('Only an owner or admin can manage role permissions.');
  }
}

export async function updateRolePermission(role: CustomizableRole, module: string, action: string, allowed: boolean): Promise<void> {
  const profile = await requireProfile();
  requireAdminRole(profile.role);

  const { error } = await supabase.from('role_permissions').upsert(
    {
      org_id: profile.org_id,
      role,
      module,
      action,
      allowed,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,role,module,action' },
  );
  if (error) throw new Error('Could not update this permission.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'role_permission.updated',
    module: 'Settings',
    entityType: 'role_permissions',
    entityLabel: `${role}: ${module}.${action}`,
    newValue: { role, module, action, allowed },
  });
}

export async function resetRolePermission(role: CustomizableRole, module: string, action: string): Promise<void> {
  const profile = await requireProfile();
  requireAdminRole(profile.role);

  const { error } = await supabase
    .from('role_permissions')
    .delete()
    .eq('org_id', profile.org_id)
    .eq('role', role)
    .eq('module', module)
    .eq('action', action);
  if (error) throw new Error('Could not reset this permission.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'role_permission.reset',
    module: 'Settings',
    entityType: 'role_permissions',
    entityLabel: `${role}: ${module}.${action}`,
  });
}
