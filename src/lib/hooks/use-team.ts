import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';

import { useAuth } from '@/lib/auth-context';
import { isAdminRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 25;

// Mirrors Inventra/lib/queries/team.ts's TeamMemberRow + TEAM_SELECT +
// mapTeamRow exactly.
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

// Live sync: another session (a Manager approving someone from web, an
// Admin changing a role from a different device) updates the profiles
// table without this screen doing anything. Each caller mounts its own
// uniquely-topic'd channel (key + a per-instance id) rather than sharing
// one — two instances racing to .subscribe() under an identical topic name
// is exactly what crashed the Team screen earlier this session (two
// useTeamMembers() calls both using `team:user:<id>`).
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

export type TeamStatusFilter = 'invited' | 'awaiting_approval' | 'active' | 'suspended' | 'rejected';

export interface TeamMembersFilters {
  search?: string;
  status?: TeamStatusFilter;
}

// Server-side paginated + filtered, mirrors Inventra/lib/queries/team.ts's
// getTeamMembersPage — profiles never deletes invited/rejected/suspended
// rows, so an org with real staff turnover can realistically accumulate
// hundreds of them, the same unbounded-growth shape Debtors/Invoices had.
export function useTeamMembersList(filters: TeamMembersFilters) {
  const { session } = useAuth();
  useProfilesRealtimeInvalidate('team-members-page');
  return useInfiniteQuery({
    queryKey: ['team-members-page', session?.user.id, filters],
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase.from('profiles').select(TEAM_SELECT, { count: 'exact' }).order('created_at', { ascending: true });

      if (filters.status === 'rejected') {
        query = query.not('rejected_at', 'is', null);
      } else if (filters.status === 'suspended') {
        query = query.not('suspended_at', 'is', null).is('rejected_at', null);
      } else if (filters.status) {
        query = query.eq('status', filters.status).is('rejected_at', null).is('suspended_at', null);
      }
      if (filters.search?.trim()) {
        const q = filters.search.trim().replace(/[%,]/g, '');
        query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw new Error('Could not load team members. Please try again.');

      return { rows: (data ?? []).map((p) => mapTeamRow(p as unknown as TeamRawRow)), total: count ?? 0, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: !!session,
  });
}

export interface TeamSummary {
  total: number;
  invited: number;
  awaitingApproval: number;
  active: number;
  suspended: number;
  rejected: number;
}

// Lightweight aggregate scan (3 columns, not the full row shape) so the
// Team screen's status-filter chips always reflect the FULL roster, not
// just the currently-loaded pages. Mirrors Inventra's getTeamSummary.
export function useTeamSummary() {
  const { session } = useAuth();
  useProfilesRealtimeInvalidate('team-summary');
  return useQuery({
    queryKey: ['team-summary', session?.user.id],
    queryFn: async (): Promise<TeamSummary> => {
      const { data, error } = await supabase.from('profiles').select('status, suspended_at, rejected_at');
      if (error) throw new Error('Could not load team summary.');

      const rows = data ?? [];
      const summary: TeamSummary = { total: rows.length, invited: 0, awaitingApproval: 0, active: 0, suspended: 0, rejected: 0 };
      for (const r of rows) {
        if (r.rejected_at) summary.rejected++;
        else if (r.suspended_at) summary.suspended++;
        else if (r.status === 'invited') summary.invited++;
        else if (r.status === 'awaiting_approval') summary.awaitingApproval++;
        else if (r.status === 'active') summary.active++;
      }
      return summary;
    },
    enabled: !!session,
  });
}

// Active members only, for the Dashboard's presence card and the
// branch-manager pickers (new/edit warehouse screens) — bounded by actual
// current headcount, not the full historical invited/rejected/suspended
// roster useTeamMembersList covers, so it doesn't need pagination. Mirrors
// Inventra's getActiveTeamMembersForPresence.
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

// Scoped to exactly what the viewer can act on — Owner/Admin see the whole
// org's queue, a Manager only sees their own branch's (matching the
// branch-scoped RLS/trigger in
// 20260801140000_branch_scoped_manager_approval.sql), so this count never
// promises more than approveMember()/rejectMember() can actually do.
// Cashier/Warehouse always get 0. Mirrors Inventra's getPendingApprovalsCount,
// replacing what (tabs)/index.tsx and (tabs)/settings/index.tsx used to
// derive by filtering a full useTeamMembers() fetch just for this pill.
export function usePendingApprovalsCount(role: string | undefined, branchId: string | null | undefined) {
  const { session } = useAuth();
  useProfilesRealtimeInvalidate('pending-approvals-count');
  const eligible = !!role && (isAdminRole(role) || (role === 'manager' && !!branchId));
  return useQuery({
    queryKey: ['pending-approvals-count', session?.user.id, role, branchId],
    queryFn: async (): Promise<number> => {
      let query = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_approval');
      if (role === 'manager') query = query.eq('branch_id', branchId as string);
      const { count, error } = await query;
      if (error) throw new Error('Could not load pending approvals.');
      return count ?? 0;
    },
    enabled: !!session && eligible,
  });
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
