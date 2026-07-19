// Direct-Supabase equivalent of Inventra/lib/actions/presence.ts's
// touchLastSeen() Server Action — same throttled "still here" heartbeat,
// called straight from the client since it only ever touches the caller's
// own row (RLS-scoped, no service-role key needed).
import { supabase } from '@/lib/supabase';

const HEARTBEAT_THROTTLE_SECONDS = 45;

export async function touchLastSeen(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const cutoff = new Date(Date.now() - HEARTBEAT_THROTTLE_SECONDS * 1000).toISOString();
  await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id)
    .or(`last_active_at.is.null,last_active_at.lt.${cutoff}`);
}
