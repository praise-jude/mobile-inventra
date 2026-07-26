import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';

// Minimal placeholder for a screen-level Premium lock — mirrors
// Inventra/components/billing/PremiumLockedState.tsx. Phase F7 replaces
// this with the full Upgrade modal experience.
export function PremiumLockedState({ feature }: { feature: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <View className="rounded-full bg-accent-weak px-3 py-1 dark:bg-accent-weak-dark">
        <Text className="text-[11px] font-bold text-accent-text dark:text-accent-text-dark">PREMIUM</Text>
      </View>
      <Text className="text-center text-[17px] font-bold text-text dark:text-text-dark">Upgrade to Inventra Premium</Text>
      <Text className="max-w-[320px] text-center text-[13px] leading-snug text-text-2 dark:text-text-2-dark">
        {feature} is a Premium feature. Unlock unlimited inventory, receipt printing, inventory editing, reports, AI
        tools, team collaboration, analytics, and more by upgrading your subscription.
      </Text>
      <Button onPress={() => router.push('/billing')} className="mt-2 px-6">
        Upgrade Now
      </Button>
    </View>
  );
}
