import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { isAdminRole } from '@/lib/roles';

export interface BranchStaffRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  branchId: string | null;
  rejectedReason: string | null;
}

// Mirrors Inventra/lib/queries/branch-staff.ts's listBranchStaff —
// profiles_select is org-wide, so this narrows to the caller's own branch
// for a Manager (matching profiles_update_manager_approval's approval
// boundary); Admin/Owner see the whole org.
export function useBranchStaff() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['branch-staff', session?.user.id],
    queryFn: async (): Promise<BranchStaffRow[]> => {
      const { data: me } = await supabase.from('profiles').select('org_id, role, branch_id').eq('id', session!.user.id).single();
      if (!me) throw new Error('Could not load your profile.');

      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, status, branch_id, rejected_reason')
        .eq('org_id', me.org_id)
        .in('status', ['invited', 'awaiting_approval', 'active'])
        .in('role', ['manager', 'cashier', 'warehouse'])
        .not('branch_id', 'is', null)
        .order('created_at', { ascending: false });

      if (!isAdminRole(me.role)) {
        query = query.eq('branch_id', me.branch_id ?? '');
      }

      const { data, error } = await query;
      if (error) throw new Error('Could not load branch staff.');

      return (data ?? []).map((p) => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        role: p.role,
        status: p.status,
        branchId: p.branch_id,
        rejectedReason: p.rejected_reason,
      }));
    },
    enabled: !!session,
  });
}
