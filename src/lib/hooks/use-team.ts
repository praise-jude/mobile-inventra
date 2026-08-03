import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

// Team Management (the invite/approve/reject/role screen, /team) was
// removed in favor of branch-code signup (see lib/actions/branches.ts) —
// this file now only backs the Dashboard's presence card and the
// branch-manager pickers (new/edit warehouse screens), which aren't part
// of that removal. Mirrors Inventra/lib/queries/team.ts's trim exactly.

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  suspendedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  approvedAt: string | null;
  acceptedAt: string | null;
  initials: string;
  lastActive: string | null;
  branchName: string | null;
}

const TEAM_SELECT =
  // profiles has two FKs to warehouses (warehouses.manager_profile_id and
  // this table's own branch_id) — PostgREST can't infer which one to embed
  // without the explicit !constraint hint.
  'id, first_name, last_name, email, role, status, suspended_at, rejected_at, rejected_reason, approved_at, accepted_at, last_active_at, warehouses!profiles_branch_id_fkey(name)';

interface TeamRawRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  suspended_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  approved_at: string | null;
  accepted_at: string | null;
  last_active_at: string | null;
  warehouses: { name: string } | { name: string }[] | null;
}

function mapTeamRow(p: TeamRawRow): TeamMemberRow {
  const branch = Array.isArray(p.warehouses) ? p.warehouses[0] : p.warehouses;
  return {
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    email: p.email,
    role: p.role,
    status: p.status,
    suspendedAt: p.suspended_at ?? null,
    rejectedAt: p.rejected_at ?? null,
    rejectedReason: p.rejected_reason ?? null,
    approvedAt: p.approved_at ?? null,
    acceptedAt: p.accepted_at ?? null,
    initials: `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase(),
    lastActive: p.last_active_at,
    branchName: branch?.name ?? null,
  };
}

// Live sync: another session (e.g. someone else's status changing) updates
// this without the screen doing anything. Each caller mounts its own
// uniquely-topic'd channel (key + a per-instance id) rather than sharing
// one — two instances racing to .subscribe() under an identical topic name
// crashed the old Team screen; keeping the same defensive shape here.
function useProfilesRealtimeInvalidate(key: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const instanceId = useId();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`team:${key}:${userId}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: [key] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [key, userId, queryClient, instanceId]);
}

// Active members only, for the Dashboard's presence card and the
// branch-manager pickers (new/edit warehouse screens) — bounded by actual
// current headcount, so it doesn't need pagination.
export function useActiveTeamMembers() {
  const { session } = useAuth();
  useProfilesRealtimeInvalidate('team-members-active');
  return useQuery({
    queryKey: ['team-members-active', session?.user.id],
    queryFn: async (): Promise<TeamMemberRow[]> => {
      const { data, error } = await supabase.from('profiles').select(TEAM_SELECT).eq('status', 'active').limit(200);
      if (error) throw new Error('Could not load team members.');
      return (data ?? []).map((p) => mapTeamRow(p as unknown as TeamRawRow));
    },
    enabled: !!session,
  });
}
