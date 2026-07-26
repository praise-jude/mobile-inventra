import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

// Mirrors Inventra/components/billing/FreePlanBanner.tsx — shown on the
// Dashboard when the org is on the Free plan.
export function FreePlanBanner() {
  return (
    <View className="mb-4 rounded-2xl border border-border bg-accent-weak p-4 dark:border-border-dark dark:bg-accent-weak-dark">
      <Text className="text-[13px] leading-snug text-text dark:text-text-dark">
        <Text className="font-bold">You&apos;re currently using the Free Plan.</Text> Upgrade to Premium to unlock
        unlimited inventory, receipt printing, reports, AI, and advanced business tools.
      </Text>
      <Pressable
        onPress={() => router.push('/billing')}
        className="mt-3 h-9 items-center justify-center self-start rounded-[9px] bg-accent px-4 dark:bg-accent-dark"
      >
        <Text className="text-[13px] font-semibold text-white">Upgrade</Text>
      </Pressable>
    </View>
  );
}
