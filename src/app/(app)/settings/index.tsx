import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/auth';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { isAdminRole } from '@/lib/roles';

const ADMIN_ROWS = [
  { href: '/settings/general' as const, icon: '🏢', label: 'General', description: 'Business name, contact, currency, tax rate' },
  { href: '/settings/notifications' as const, icon: '🔔', label: 'Notifications', description: 'Low stock, expiring products, weekly digest' },
  { href: '/settings/printing' as const, icon: '🖨️', label: 'Receipts & Printing', description: 'Paper size, auto-print, receipt footer' },
];

// Mirrors Inventra/components/settings/SettingsTabs.tsx's section nav —
// the whole /settings area is admin-tier+ on web (Sidebar.tsx's
// `adminOnly: true`), so non-admins only see their own account info here,
// not the business-config rows.
export default function SettingsScreen() {
  const { session } = useAuth();
  const profileQuery = useMyProfile();
  const isAdmin = isAdminRole(profileQuery.data?.role ?? '');

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-1 px-6 py-8">
        <Text className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Settings</Text>
        <Text className="mt-1 text-[13.5px] text-text-2 dark:text-text-2-dark">Signed in as {session?.user.email}</Text>

        {isAdmin ? (
          <View className="mt-6 gap-2.5">
            {ADMIN_ROWS.map((row) => (
              <Pressable
                key={row.href}
                onPress={() => {
                  haptics.tap();
                  router.push(row.href);
                }}
                className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
              >
                <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                  <Text className="text-[18px]">{row.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-semibold text-text dark:text-text-dark">{row.label}</Text>
                  <Text className="text-[11.5px] text-muted dark:text-muted-dark">{row.description}</Text>
                </View>
                <Text className="text-text-2 dark:text-text-2-dark">›</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="mt-6 rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[13px] font-bold text-text dark:text-text-dark">Business settings</Text>
            <Text className="mt-1 text-[12.5px] leading-snug text-text-2 dark:text-text-2-dark">
              Only a workspace owner or admin can view and change business settings.
            </Text>
          </View>
        )}

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
