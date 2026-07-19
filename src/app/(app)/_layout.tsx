import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { registerPushToken } from '@/lib/actions/notifications';

export default function AppLayout() {
  // Fires once this layout mounts, i.e. only once every gate (MFA,
  // onboarding, approval, billing) has already passed — registering
  // earlier would mean asking for notification permissions before the
  // account can even do anything yet.
  useEffect(() => {
    void registerPushToken();
  }, []);

  return <AppTabs />;
}
