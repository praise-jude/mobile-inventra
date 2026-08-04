import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { inviteBranchStaff } from '@/lib/actions/branch-staff';
import { haptics } from '@/lib/haptics';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useWarehousesOverview } from '@/lib/hooks/use-warehouses';
import { isAdminRole } from '@/lib/roles';

const ADMIN_ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'warehouse', label: 'Warehouse' },
];
// A Manager may only invite Staff to their own branch — enforced again
// server-side in Inventra/lib/branch-staff-service.ts's
// MANAGER_INVITABLE_ROLES/branch-ownership check, this just keeps the
// picker from offering a choice the server would reject.
const MANAGER_ROLE_OPTIONS = [
  { value: 'cashier', label: 'Cashier' },
  { value: 'warehouse', label: 'Warehouse' },
];

export default function InviteBranchStaffScreen() {
  const queryClient = useQueryClient();
  const profileQuery = useMyProfile();
  const warehousesQuery = useWarehousesOverview();
  const isAdmin = isAdminRole(profileQuery.data?.role ?? '');
  const roleOptions = isAdmin ? ADMIN_ROLE_OPTIONS : MANAGER_ROLE_OPTIONS;
  const ownBranchId = profileQuery.data?.branch_id ?? '';
  const ownBranchName = (warehousesQuery.data ?? []).find((w) => w.id === ownBranchId)?.name;

  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: roleOptions[0].value, branchId: isAdmin ? '' : ownBranchId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branchOptions = (warehousesQuery.data ?? []).map((w) => ({ label: w.name, value: w.id }));

  async function handleInvite() {
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      setError('Fill in every field before sending the invite.');
      return;
    }
    if (!form.branchId) {
      setError('Pick a branch for this member.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await inviteBranchStaff({
        email: form.email.trim(),
        role: form.role,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        branchId: form.branchId,
      });
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['branch-staff'] });
      router.back();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not send the invite.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Cancel</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Invite staff</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          onChangeText={(v) => setForm({ ...form, email: v })}
        />
        <TextField label="First name" value={form.firstName} onChangeText={(v) => setForm({ ...form, firstName: v })} />
        <TextField label="Last name" value={form.lastName} onChangeText={(v) => setForm({ ...form, lastName: v })} />
        <SelectField label="Role" value={form.role} options={roleOptions} onChange={(v) => setForm({ ...form, role: v })} />

        {isAdmin ? (
          <SelectField
            label="Branch"
            placeholder="Select branch…"
            value={form.branchId}
            options={branchOptions}
            onChange={(v) => setForm({ ...form, branchId: v })}
          />
        ) : (
          <View>
            <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Branch</Text>
            <View className="rounded-[10px] border border-border bg-hover px-3.5 py-2.5 dark:border-border-dark dark:bg-hover-dark">
              <Text className="text-[14px] text-text dark:text-text-dark">{ownBranchName ?? 'Your branch'}</Text>
            </View>
          </View>
        )}

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleInvite} className="mt-2">
          Send invite
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
