import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { resetRolePermission, updateRolePermission } from '@/lib/actions/roles';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import {
  ACTION_LABELS,
  CUSTOMIZABLE_ROLES,
  DEFAULT_PERMISSIONS,
  MODULE_ACTIONS,
  MODULE_LABELS,
  PERMISSION_MODULES,
  type CustomizableRole,
} from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { RolePermissionRow } from '@/types/database';

const ROLE_LABELS: Record<CustomizableRole, string> = {
  manager: 'Manager',
  cashier: 'Cashier',
  warehouse: 'Warehouse',
};

// Mirrors Inventra/components/settings/RolesClient.tsx — same matrix, same
// defaults (DEFAULT_PERMISSIONS in lib/permissions.ts), same RPC
// (has_permission) both apps' role checks resolve against.
export default function RolesSettingsScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['role-permissions', session?.user.id],
    queryFn: async (): Promise<{ orgId: string; overrides: Map<string, boolean> }> => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', session!.user.id)
        .single();
      if (profileError || !profile) throw new Error('Could not load your profile.');

      const { data: rows, error } = await supabase
        .from('role_permissions')
        .select('role, module, action, allowed')
        .eq('org_id', profile.org_id);
      if (error) throw new Error('Could not load role permissions.');

      const overrides = new Map<string, boolean>(
        (rows as Pick<RolePermissionRow, 'role' | 'module' | 'action' | 'allowed'>[]).map((r) => [`${r.role}:${r.module}:${r.action}`, r.allowed]),
      );
      return { orgId: profile.org_id, overrides };
    },
    enabled: !!session,
  });

  const [pending, setPending] = useState<string | null>(null);

  function keyFor(role: CustomizableRole, module: string, action: string) {
    return `${role}:${module}:${action}`;
  }

  async function handleToggle(role: CustomizableRole, module: string, action: string, current: boolean) {
    const key = keyFor(role, module, action);
    haptics.select();
    setPending(key);
    try {
      await updateRolePermission(role, module, action, !current);
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    } catch {
      haptics.warning();
    } finally {
      setPending(null);
    }
  }

  async function handleReset(role: CustomizableRole, module: string, action: string) {
    const key = keyFor(role, module, action);
    haptics.select();
    setPending(key);
    try {
      await resetRolePermission(role, module, action);
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    } catch {
      haptics.warning();
    } finally {
      setPending(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Roles</Text>
        <View className="w-14" />
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError || !query.data ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <ScrollView contentContainerClassName="gap-4 p-5 pb-10">
          <Text className="text-[12.5px] leading-snug text-text-2 dark:text-text-2-dark">
            Fine-tune what Manager, Cashier, and Warehouse accounts can do beyond their default access. Changes apply
            immediately, org-wide, on both web and mobile.
          </Text>

          <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">Owner &amp; Admin</Text>
            <Text className="mt-0.5 text-[12px] text-muted dark:text-muted-dark">Always have full access — this can&apos;t be changed.</Text>
          </View>

          {PERMISSION_MODULES.map((mod) => (
            <View key={mod} className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <Text className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">{MODULE_LABELS[mod]}</Text>
              <View className="gap-4">
                {MODULE_ACTIONS[mod].map((action) => (
                  <View key={action} className="gap-2">
                    <Text className="text-[13px] font-semibold text-text dark:text-text-dark">{ACTION_LABELS[action] ?? action}</Text>
                    {CUSTOMIZABLE_ROLES.map((role) => {
                      const key = keyFor(role, mod, action);
                      const override = query.data.overrides.get(key);
                      const value = override ?? DEFAULT_PERMISSIONS[role][mod][action];
                      const isOverride = override !== undefined;
                      return (
                        <View key={role} className="flex-row items-center justify-between">
                          <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">{ROLE_LABELS[role]}</Text>
                          <View className="flex-row items-center gap-2.5">
                            {isOverride && (
                              <Pressable disabled={pending === key} onPress={() => handleReset(role, mod, action)} hitSlop={8}>
                                <Text className="text-[11px] font-medium text-accent-text underline dark:text-accent-text-dark">Reset</Text>
                              </Pressable>
                            )}
                            <Switch
                              value={value}
                              disabled={pending === key}
                              onValueChange={() => handleToggle(role, mod, action, value)}
                              trackColor={{ false: '#e5e7eb', true: '#2563eb' }}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
