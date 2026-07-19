import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { inviteMember } from '@/lib/actions/team';
import { haptics } from '@/lib/haptics';
import { useTeamMembers, useBranches } from '@/lib/hooks/use-team';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'warehouse', label: 'Warehouse' },
];

// Mirrors Inventra/components/team/InviteMemberModal.tsx as a full screen
// instead of a dialog — same fields, same admin-API-backed submit path.
export default function InviteMemberScreen() {
  const teamQuery = useTeamMembers();
  const branchesQuery = useBranches();
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'cashier', branchId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branchOptions = (branchesQuery.data ?? []).map((b) => ({ value: b.id, label: b.name }));

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
      await inviteMember({
        email: form.email.trim(),
        role: form.role,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        branchId: form.branchId,
      });
      haptics.success();
      await teamQuery.invalidate();
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
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Invite member</Text>
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
        <SelectField label="Role" value={form.role} options={ROLE_OPTIONS} onChange={(v) => setForm({ ...form, role: v })} />
        <SelectField
          label="Branch"
          placeholder="Select branch…"
          value={form.branchId}
          options={branchOptions}
          onChange={(v) => setForm({ ...form, branchId: v })}
        />

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={saving} onPress={handleInvite} className="mt-2">
          Send invite
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
