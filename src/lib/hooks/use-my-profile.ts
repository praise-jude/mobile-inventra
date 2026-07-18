import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

// Used across Sales/Inventory screens to gate which actions are shown
// (Edit/Delete/Transfer for managers, "record sale" not shown to
// warehouse-role accounts, etc.) — the corresponding lib/actions/* function
// still enforces the same rule server-side/via RLS regardless, this is UX
// only (don't show a button that would just throw).
export function useMyProfile() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-profile', session?.user.id],
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session!.user.id).single();
      if (error || !data) throw new Error('Could not load your profile.');
      return data;
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 5,
  });
}
