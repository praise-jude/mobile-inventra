import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PremiumLockedState } from '@/components/premium-locked-state';
import { useEntitlements } from '@/lib/hooks/use-entitlements';

// Gated here (not just reports/index.tsx) so every screen in this group —
// index, inventory-valuation, profit-loss — is covered regardless of entry
// point, matching web's page-level gate on app/(app)/reports/page.tsx.
export default function ReportsLayout() {
  const entitlementsQuery = useEntitlements();

  if (entitlementsQuery.data && entitlementsQuery.data.tier !== 'premium') {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <PremiumLockedState feature="Reports" />
      </SafeAreaView>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
