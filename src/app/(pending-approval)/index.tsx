import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/auth';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';

interface PendingApprovalInfo {
  orgName: string;
  branchName: string | null;
  invitedByName: string | null;
}

// Mirrors Inventra's app/pending-approval/page.tsx — shown while
// awaitingApproval is true (see auth-context.tsx), i.e. a Manager-invited
// member who's accepted their invite but hasn't been approved yet.
function usePendingApprovalInfo() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['pending-approval-info', session?.user.id],
    queryFn: async (): Promise<PendingApprovalInfo> => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, branch_id, invited_by')
        .eq('id', session!.user.id)
        .single();
      if (!profile) throw new Error('No profile');

      const [orgRes, branchRes, inviterRes] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', profile.org_id).single(),
        profile.branch_id ? supabase.from('warehouses').select('name').eq('id', profile.branch_id).single() : Promise.resolve({ data: null }),
        profile.invited_by
          ? supabase.from('profiles').select('first_name, last_name').eq('id', profile.invited_by).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        orgName: orgRes.data?.name ?? 'your workspace',
        branchName: branchRes.data?.name ?? null,
        invitedByName: inviterRes.data ? `${inviterRes.data.first_name} ${inviterRes.data.last_name}` : null,
      };
    },
    enabled: !!session,
  });
}

export default function PendingApprovalScreen() {
  const { refetchGate } = useAuth();
  const infoQuery = usePendingApprovalInfo();

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-1 justify-center px-6">
        <View className="mb-4 h-[46px] w-[46px] items-center justify-center rounded-xl bg-amber-weak dark:bg-amber-weak-dark">
          <Text className="text-[22px]">⏳</Text>
        </View>
        <Text className="mb-1.5 text-2xl font-bold text-text dark:text-text-dark">Awaiting approval</Text>
        <Text className="mb-6 text-[14px] text-text-2 dark:text-text-2-dark">
          Your account is awaiting approval from your Branch Manager.
        </Text>

        <View className="gap-3.5 rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
          {infoQuery.isLoading ? (
            <ActivityIndicator />
          ) : (
            <>
              <InfoRow label="Company" value={infoQuery.data?.orgName ?? '—'} />
              <InfoRow label="Branch" value={infoQuery.data?.branchName ?? '—'} />
              <InfoRow label="Invited by" value={infoQuery.data?.invitedByName ?? '—'} />
              <View className="flex-row items-center justify-between">
                <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">Status</Text>
                <View className="rounded-full bg-sky-weak px-2.5 py-1 dark:bg-sky-weak-dark">
                  <Text className="text-[11px] font-bold text-sky dark:text-sky-dark">Awaiting approval</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Button
          variant="secondary"
          className="mt-4"
          onPress={() => {
            haptics.tap();
            refetchGate();
          }}
        >
          Refresh
        </Button>
        <Button
          variant="ghost"
          className="mt-2"
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{label}</Text>
      <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{value}</Text>
    </View>
  );
}
