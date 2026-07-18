import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/auth';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';

// General settings (theme, printing, integrations, notifications) aren't
// ported to mobile yet — but account access (sign out) is a real,
// non-deferrable action, so this isn't a pure <ComingSoon /> like the other
// unbuilt tabs.
export default function SettingsScreen() {
  const { session } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-1 px-6 py-8">
        <Text className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Settings</Text>
        <Text className="mt-1 text-[13.5px] text-text-2 dark:text-text-2-dark">
          Signed in as {session?.user.email}
        </Text>

        <View className="mt-6 rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
          <Text className="text-[13px] font-bold text-text dark:text-text-dark">More settings, coming soon</Text>
          <Text className="mt-1 text-[12.5px] leading-snug text-text-2 dark:text-text-2-dark">
            Theme, printing, integrations, and notification preferences will move here in a future update.
          </Text>
        </View>

        <Button
          variant="secondary"
          className="mt-6"
          onPress={() => {
            haptics.tap();
            void signOut();
          }}
        >
          Sign out
        </Button>
      </View>
    </SafeAreaView>
  );
}
