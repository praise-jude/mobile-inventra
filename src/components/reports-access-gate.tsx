import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHasPermission } from '@/lib/hooks/use-permissions';

// Reports' RPCs (get_sales_summary etc.) have zero role gating of their
// own — this is the actual enforcement boundary on mobile for every Reports
// screen, mirroring web's requireReportsProfile(). The dashboard nav row
// already hides the entry point, but each screen still needs its own check
// since they're independently deep-linkable.
export function ReportsAccessGate({ children }: { children: React.ReactNode }) {
  const permissionQuery = useHasPermission('reports', 'view');

  if (permissionQuery.data === false) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8 dark:bg-bg-dark">
        <Text className="text-center text-[14px] font-semibold text-text dark:text-text-dark">You don&apos;t have access to Reports</Text>
        <Text className="mt-1 text-center text-[12.5px] text-text-2 dark:text-text-2-dark">
          Ask an owner or admin to grant access from Settings &gt; Roles.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4" hitSlop={10}>
          <Text className="text-[13px] font-semibold text-accent-text dark:text-accent-text-dark">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}
