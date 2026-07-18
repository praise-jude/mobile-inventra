import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

// Shared by every Sales/Inventory action that needs the caller's profile
// (org_id + role) before writing — mirrors the "get the authenticated
// profile" step Inventra/lib/queries/session.ts's requireProfile does
// server-side, minus the redirect-on-missing-session behavior (mobile's
// root navigator already gates unauthenticated access before any of these
// actions are reachable, see src/app/_layout.tsx).
export async function requireProfile(): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error || !profile) throw new Error('No profile');
  return profile;
}
