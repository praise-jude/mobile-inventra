import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { SupportWidget } from '@/components/support-widget';
import { registerPushToken } from '@/lib/actions/notifications';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { PresenceProvider } from '@/lib/presence-context';

// A Stack, not NativeTabs, wrapping everything under (app) — (tabs)/ is
// one screen in it (the 5 bottom-bar destinations), and every other
// screen that used to be a `hidden` NativeTabs.Trigger (Cash Register,
// Invoices, Team, Customers, Expenses, Support, Audit Log, Reports,
// Notifications, Ask AI) is now a plain sibling Stack screen instead.
//
// Root cause this fixes: those 10 screens were tap-dead — onPress fired
// (confirmed no haptic either, so really the whole handler was a no-op
// once router.push resolved a hidden trigger) — because Expo's own docs
// state a NativeTabs.Trigger's `hidden` prop means the route "cannot be
// navigated to in any way," not just "hidden from the tab bar strip" as
// this app's code assumed when it was first wired up. A Stack has no
// such restriction; router.push to any of these now behaves like every
// other screen in the app.
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

  const stack = <Stack screenOptions={{ headerShown: false }} />;

  // Profile is normally already warm from the access-gate query by the time
  // this layout mounts, so this unwrapped state is brief/rare — but
  // PresenceProvider needs a real org/user id, so it can't render before
  // profile data exists.
  if (!profile) return stack;

  return (
    <PresenceProvider userId={profile.id} orgId={profile.org_id} name={`${profile.first_name} ${profile.last_name}`} role={profile.role}>
      <View style={{ flex: 1 }}>
        {stack}
        <SupportWidget />
      </View>
    </PresenceProvider>
  );
}
