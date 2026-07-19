import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Thin react-query wrapper around has_permission() — see
// src/lib/permissions.ts for the throwing Server-Action-style version used
// by writes; this is the read-only version screens use to decide what to
// render. Same RPC, same org-scoped session, so results always agree.
export function useHasPermission(module: string, action: string) {
  return useQuery({
    queryKey: ['has-permission', module, action],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_permission', { p_module: module, p_action: action });
      if (error) throw new Error('Could not check permissions.');
      return data;
    },
  });
}
