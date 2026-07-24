import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/auth';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { isAdminRole, isManagerRole } from '@/lib/roles';

// Security (MFA) is every role's own account setting, unconditional —
// mirrors Inventra/app/(app)/account/security/page.tsx's comment: "every
// role needs to reach this page", deliberately not under the admin-tier
// gate the rest of /settings uses. Team is Manager-tier+ (a Manager can
// invite Staff and approve/reject them, restricted further inside the
// Team screen itself) — everything else here is business config and
// stays Admin-tier+, mirroring Sidebar.tsx's managerOnly/adminOnly split
// on web.
const ALWAYS_ROWS = [{ href: '/settings/security' as const, icon: '🔐', label: 'Security', description: 'Two-factor authentication, recovery codes' }];
const MANAGER_ROWS = [{ href: '/team' as const, icon: '👥', label: 'Team', description: 'Members, roles, invites, approvals' }];
const ADMIN_ROWS = [
  { href: '/settings/general' as const, icon: '🏢', label: 'General', description: 'Business name, contact, currency, tax rate' },
  { href: '/settings/roles' as const, icon: '🛡️', label: 'Roles', description: 'Customize what Manager, Cashier & Warehouse can do' },
  { href: '/settings/notifications' as const, icon: '🔔', label: 'Notifications', description: 'Low stock, expiring products, weekly digest' },
  { href: '/settings/printing' as const, icon: '🖨️', label: 'Receipts & Printing', description: 'Paper size, auto-print, receipt footer' },
  { href: '/settings/approvals' as const, icon: '✅', label: 'Approvals', description: 'Require sign-off for large discounts, voids, price changes' },
];

// Mirrors Inventra/components/settings/SettingsTabs.tsx's section nav —
// the business-config rows are admin-tier+ (Sidebar.tsx's `adminOnly:
// true`), so non-admins only see Security (+ Team, if Manager-tier+).
export default function SettingsScreen() {
  const { session } = useAuth();
  const profileQuery = useMyProfile();
  const isAdmin = isAdminRole(profileQuery.data?.role ?? '');
  const isManagerUp = isManagerRole(profileQuery.data?.role ?? '');

  function Row(row: {
    href:
      | '/settings/security'
      | '/team'
      | '/settings/general'
      | '/settings/roles'
      | '/settings/notifications'
      | '/settings/printing'
      | '/settings/approvals';
    icon: string;
    label: string;
    description: string;
  }) {
    return (
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
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-1 px-6 py-8">
        <Text className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Settings</Text>
        <Text className="mt-1 text-[13.5px] text-text-2 dark:text-text-2-dark">Signed in as {session?.user.email}</Text>

        <View className="mt-6 gap-2.5">
          {ALWAYS_ROWS.map((row) => <Row key={row.href} {...row} />)}
          {isManagerUp && MANAGER_ROWS.map((row) => <Row key={row.href} {...row} />)}
          {isAdmin && ADMIN_ROWS.map((row) => <Row key={row.href} {...row} />)}
        </View>

        {!isManagerUp && (
          <View className="mt-2.5 rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[13px] font-bold text-text dark:text-text-dark">Business settings</Text>
            <Text className="mt-1 text-[12.5px] leading-snug text-text-2 dark:text-text-2-dark">
              Only a workspace owner, admin, or manager can view business settings.
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
