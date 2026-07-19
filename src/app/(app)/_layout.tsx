import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { registerPushToken } from '@/lib/actions/notifications';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { PresenceProvider } from '@/lib/presence-context';

export default function AppLayout() {
  // Fires once this layout mounts, i.e. only once every gate (MFA,
  // onboarding, approval, billing) has already passed — registering
  // earlier would mean asking for notification permissions before the
  // account can even do anything yet.
  useEffect(() => {
    void registerPushToken();
  }, []);

  const profileQuery = useMyProfile();
  const profile = profileQuery.data;

  // Profile is normally already warm from the access-gate query by the time
  // this layout mounts, so this unwrapped state is brief/rare — but
  // PresenceProvider needs a real org/user id, so it can't render before
  // profile data exists.
  if (!profile) return <AppTabs />;

  return (
    <PresenceProvider userId={profile.id} orgId={profile.org_id} name={`${profile.first_name} ${profile.last_name}`} role={profile.role}>
      <AppTabs />
    </PresenceProvider>
  );
}
