import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

// Mirrors Inventra/lib/queries/team.ts's TeamMemberRow + getTeamMembers.
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
  initials: string;
  lastActive: string | null;
  branchName: string | null;
}

export function useTeamMembers() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['team-members', session?.user.id],
    queryFn: async (): Promise<TeamMemberRow[]> => {
      const { data, error } = await supabase
        .from('profiles')
        // profiles has two FKs to warehouses (warehouses.manager_profile_id
        // and this table's own branch_id) — PostgREST can't infer which one
        // to embed without the explicit !constraint hint.
        .select(
          'id, first_name, last_name, email, role, status, suspended_at, rejected_at, rejected_reason, approved_at, last_active_at, warehouses!profiles_branch_id_fkey(name)',
        )
        .order('created_at', { ascending: true });
      if (error) throw new Error('Could not load team members. Please try again.');

      return (data ?? []).map((p) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        email: p.email,
        role: p.role,
        status: p.status,
        suspendedAt: p.suspended_at ?? null,
        rejectedAt: p.rejected_at ?? null,
        rejectedReason: p.rejected_reason ?? null,
        approvedAt: p.approved_at ?? null,
        initials: `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase(),
        lastActive: p.last_active_at,
        branchName: (p.warehouses as unknown as { name: string } | null)?.name ?? null,
      }));
    },
    enabled: !!session,
  });

  // Live sync: another session (a Manager approving someone from web, an
  // Admin changing a role from a different device) updates this table
  // without this screen doing anything — no `filter` needed, Realtime is
  // RLS-aware per connection so this only ever receives rows this session
  // could already SELECT (i.e. same-org), same as Inventra/components/
  // team/TeamClient.tsx's channel.
  // Depend on the user id (a stable primitive), not `session` itself — the
  // session object gets a new reference on every auth event (token
  // refresh included, not just sign-in/out), so using it directly as a
  // dependency re-ran this effect far more often than the user actually
  // changed. Each re-run recreated a channel with the exact same topic
  // name before the previous one's async removeChannel() had necessarily
  // finished tearing down, which Supabase's client surfaces as "cannot
  // add postgres_changes callbacks... after subscribe()" — the crash
  // that made this whole screen render blank.
  // useTeamMembers() is called from several screens that can be mounted at
  // the same time (Dashboard, Team, warehouse forms) — each call needs its
  // own channel topic, otherwise two concurrent instances both try to
  // subscribe under the identical `team:user:<id>` topic and the second
  // one's .subscribe() throws "cannot add postgres_changes callbacks...
  // after subscribe()", which is what was crashing the Team screen even
  // after the session-vs-userId dependency fix.
  const instanceId = useId();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`team:user:${userId}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['team-members'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient, instanceId]);

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  };
}

export function useBranches() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['branches', session?.user.id],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase.from('warehouses').select('id, name').order('name', { ascending: true });
      if (error) throw new Error('Could not load branches.');
      return data ?? [];
    },
    enabled: !!session,
  });
}
