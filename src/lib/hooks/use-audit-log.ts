import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { orIlike } from '@/lib/postgrest-filter';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 25;

export interface AuditLogRow {
  id: string;
  createdAt: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  entityLabel: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}

export interface AuditLogFilters {
  search?: string;
  module?: string;
  dateFrom?: string;
  dateTo?: string;
}

const SELECT = 'id, created_at, actor_name, actor_role, action, module, entity_label, previous_value, new_value';

function mapRow(r: Record<string, unknown>): AuditLogRow {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    actorName: r.actor_name as string,
    actorRole: r.actor_role as string,
    action: r.action as string,
    module: r.module as string,
    entityLabel: (r.entity_label as string | null) ?? null,
    previousValue: (r.previous_value as Record<string, unknown> | null) ?? null,
    newValue: (r.new_value as Record<string, unknown> | null) ?? null,
  };
}

// Mirrors Inventra/lib/queries/audit.ts's getAuditLogs — audit_logs_select
// RLS already restricts reads to owner/admin, so this returns an empty page
// (not an error) for anyone else. CSV export isn't ported — mobile has no
// file-sharing-friendly CSV writer wired up yet.
export function useAuditLogs(filters: AuditLogFilters) {
  return useInfiniteQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase.from('audit_logs').select(SELECT, { count: 'exact' }).order('created_at', { ascending: false });
      if (filters.search?.trim()) {
        query = query.or(orIlike(['actor_name', 'action', 'entity_label'], filters.search));
      }
      if (filters.module) query = query.eq('module', filters.module);
      if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
      if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);

      const { data, error, count } = await query.range(from, to);
      if (error) throw new Error('Could not load the audit log.');
      return { rows: (data ?? []).map(mapRow), total: count ?? 0, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}

// Mirrors Inventra/lib/queries/audit.ts's getAuditModules.
export function useAuditModules() {
  return useQuery({
    queryKey: ['audit-modules'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('audit_logs').select('module').limit(1000);
      if (error) return [];
      return Array.from(new Set((data ?? []).map((r) => r.module as string))).sort();
    },
  });
}
