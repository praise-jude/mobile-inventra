import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/auth';
import { useAuth } from '@/lib/auth-context';

// Placeholder landing screen for onboarded users — the real dashboard
// (matching Inventra's app/(app)/dashboard) is a separate future feature.
// This exists so the onboarding gate has somewhere to land and can be
// verified end-to-end.
export default function DashboardStub() {
  const { session } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-center text-2xl font-bold text-text dark:text-text-dark">You&apos;re all set</Text>
        <Text className="text-center text-[14px] text-text-2 dark:text-text-2-dark">
          Signed in as {session?.user.email}. The full dashboard is coming in a follow-up feature.
        </Text>
        <Button variant="secondary" onPress={() => void signOut()} className="mt-4">
          Sign out
        </Button>
      </View>
    </SafeAreaView>
  );
}
