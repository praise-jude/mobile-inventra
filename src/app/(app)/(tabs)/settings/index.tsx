import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/auth';
import { getGoogleCloudStatus } from '@/lib/actions/google-cloud';
import { getSlackStatus } from '@/lib/actions/slack';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { isAdminRole } from '@/lib/roles';

// Security (MFA) is every role's own account setting, unconditional —
// mirrors Inventra/app/(app)/account/security/page.tsx's comment: "every
// role needs to reach this page", deliberately not under the admin-tier
// gate the rest of /settings uses.
//
// Manager/Cashier/Warehouse ("branch" roles) get a deliberately narrow
// settings screen now — mirrors Sidebar.tsx on web: everything
// admin-adjacent (branch management, staff, approvals, suppliers, cash
// reconciliation, customer credit) moved into ADMIN_ROWS (owner/admin
// only). Expenses used to be manager-tier+ only; widened into
// ALWAYS_ROWS since branch roles need it too. Branch Staff's row was
// removed outright — Admin already reaches the same feature via the
// Staff panel on the web Branches page; mobile's manager loses a
// dedicated entry point, but the page itself still works if linked
// directly.
const ALWAYS_ROWS = [
  { href: '/settings/appearance' as const, icon: '🎨', label: 'Appearance', description: 'Light, dark, or match your device' },
  { href: '/settings/security' as const, icon: '🔐', label: 'Security', description: 'Two-factor authentication, recovery codes' },
  { href: '/support' as const, icon: '💬', label: 'Contact support', description: 'Email or WhatsApp us directly' },
  { href: '/expenses' as const, icon: '💸', label: 'Expenses', description: 'Log rent, salary, transport and other spend' },
];
// Invoices matches Sidebar.tsx's `hideForWarehouse` scope on web (every
// role except Warehouse can create one).
const SALES_ROWS = [{ href: '/invoices' as const, icon: '📄', label: 'Invoices', description: 'Create and track customer invoices' }];
const ADMIN_ROWS = [
  { href: '/settings/general' as const, icon: '🏢', label: 'General', description: 'Business name, contact, currency, tax rate' },
  { href: '/inventory/warehouses' as const, icon: '👥', label: 'Branches', description: 'Manage branches and generate signup codes' },
  { href: '/settings/roles' as const, icon: '🛡️', label: 'Roles', description: 'Customize what Manager, Cashier & Warehouse can do' },
  { href: '/settings/notifications' as const, icon: '🔔', label: 'Notifications', description: 'Low stock, expiring products, weekly digest' },
  { href: '/settings/printing' as const, icon: '🖨️', label: 'Receipts & Printing', description: 'Paper size, auto-print, receipt footer' },
  { href: '/settings/approvals' as const, icon: '✅', label: 'Approvals', description: 'Require sign-off for large discounts, voids, price changes' },
  { href: '/audit-log' as const, icon: '🛡️', label: 'Audit Log', description: 'Who changed what, and when' },
  { href: '/cash-register' as const, icon: '🧮', label: 'Cash Register', description: "Opening float, today's cash position, and close-of-day" },
  { href: '/customers' as const, icon: '💵', label: 'Customers', description: 'Track customer credit balances and payments' },
  { href: '/supply-records' as const, icon: '🚛', label: 'Supply Records', description: 'Record deliveries from suppliers and track cost' },
];

function StatusRow({
  icon,
  label,
  sub,
  loading,
  connected,
  notConfiguredLabel,
}: {
  icon: string;
  label: string;
  sub: string;
  loading: boolean;
  connected: boolean;
  notConfiguredLabel: string;
}) {
  return (
    <View className="mt-2.5 flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <View className={`h-10 w-10 items-center justify-center rounded-[10px] ${connected ? 'bg-green-weak dark:bg-green-weak-dark' : 'bg-red-weak dark:bg-red-weak-dark'}`}>
        <Text className="text-[18px]">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-text dark:text-text-dark">{label}</Text>
        <Text className="text-[11.5px] text-muted dark:text-muted-dark">{sub}</Text>
      </View>
      <View
        className={`rounded-[20px] px-2.5 py-0.5 ${
          loading ? 'bg-border-2 dark:bg-border-2-dark' : connected ? 'bg-green-weak dark:bg-green-weak-dark' : 'bg-red-weak dark:bg-red-weak-dark'
        }`}
      >
        <Text
          className={`text-[11px] font-bold ${
            loading ? 'text-muted dark:text-muted-dark' : connected ? 'text-green dark:text-green-dark' : 'text-red dark:text-red-dark'
          }`}
        >
          {loading ? 'Checking…' : connected ? 'Connected' : notConfiguredLabel}
        </Text>
      </View>
    </View>
  );
}

// Mirrors Inventra/components/settings/SettingsTabs.tsx's section nav —
// the business-config rows are admin-tier+ (Sidebar.tsx's `adminOnly:
// true`), so non-admins only see Security (+ Team, if Manager-tier+).
export default function SettingsScreen() {
  const { session } = useAuth();
  const profileQuery = useMyProfile();
  const isAdmin = isAdminRole(profileQuery.data?.role ?? '');

  const isWarehouse = profileQuery.data?.role === 'warehouse';

  // Mirrors Inventra/app/(app)/settings/integrations/page.tsx's Cloud
  // Storage card — live-checked (not a cosmetic toggle), admin-only since
  // it's an infra concern, not a day-to-day operational one.
  const cloudStatusQuery = useQuery({
    queryKey: ['google-cloud-status'],
    queryFn: getGoogleCloudStatus,
    enabled: isAdmin,
    staleTime: 1000 * 60,
  });

  // Read-only here — connecting/disconnecting Slack stays web-only
  // (Settings -> Integrations, needs a webhook URL form). Mirrors
  // Inventra's same status card.
  const slackStatusQuery = useQuery({
    queryKey: ['slack-status', profileQuery.data?.org_id],
    queryFn: () => getSlackStatus(profileQuery.data!.org_id),
    enabled: isAdmin && !!profileQuery.data?.org_id,
    staleTime: 1000 * 60,
  });

  function Row(row: {
    href:
      | '/settings/appearance'
      | '/settings/security'
      | '/support'
      | '/expenses'
      | '/invoices'
      | '/settings/general'
      | '/inventory/warehouses'
      | '/settings/roles'
      | '/settings/notifications'
      | '/settings/printing'
      | '/settings/approvals'
      | '/audit-log'
      | '/cash-register'
      | '/customers'
      | '/supply-records';
    icon: string;
    label: string;
    description: string;
    badge?: number;
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
        {!!row.badge && row.badge > 0 && (
          <View className="rounded-[20px] bg-sky-weak px-1.5 py-px dark:bg-sky-weak-dark">
            <Text className="font-mono text-[10.5px] font-bold text-sky dark:text-sky-dark">{row.badge}</Text>
          </View>
        )}
        <Text className="text-text-2 dark:text-text-2-dark">›</Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="px-6 py-8" showsVerticalScrollIndicator={false}>
        <Text className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Settings</Text>
        <Text className="mt-1 text-[13.5px] text-text-2 dark:text-text-2-dark">Signed in as {session?.user.email}</Text>

        <View className="mt-6 gap-2.5">
          {ALWAYS_ROWS.map((row) => <Row key={row.href} {...row} />)}
          {!isWarehouse && SALES_ROWS.map((row) => <Row key={row.href} {...row} />)}
          {isAdmin && ADMIN_ROWS.map((row) => <Row key={row.href} {...row} />)}
        </View>

        {isAdmin && (
          <>
            <StatusRow
              icon="☁️"
              label="Google Cloud Storage"
              sub="Invoice PDF archival"
              loading={cloudStatusQuery.isLoading}
              connected={!!cloudStatusQuery.data?.connected}
              notConfiguredLabel={cloudStatusQuery.data?.configured ? 'Unreachable' : 'Not configured'}
            />
            <StatusRow
              icon="💬"
              label="Slack"
              sub="Stock alerts to channels"
              loading={slackStatusQuery.isLoading}
              connected={!!slackStatusQuery.data?.connected}
              notConfiguredLabel="Not connected"
            />
          </>
        )}

        {!isAdmin && (
          <View className="mt-2.5 rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[13px] font-bold text-text dark:text-text-dark">Business settings</Text>
            <Text className="mt-1 text-[12.5px] leading-snug text-text-2 dark:text-text-2-dark">
              Only a workspace owner or admin can view business settings.
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
      </ScrollView>
    </SafeAreaView>
  );
}
