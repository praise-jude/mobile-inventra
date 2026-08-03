import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import {
  archiveWarehouse,
  deleteWarehouse,
  generateBranchCode,
  reactivateWarehouse,
  revokeBranchCode,
  transferWarehouseStock,
  updateWarehouse,
  type WarehouseInput,
} from '@/lib/actions/warehouses';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useActiveTeamMembers } from '@/lib/hooks/use-team';
import { useProductsInWarehouse, useWarehousesOverview } from '@/lib/hooks/use-warehouses';
import { isAdminRole, isManagerRole } from '@/lib/roles';

// Mirrors Inventra/components/inventory/WarehouseModal.tsx +
// TransferStockModal.tsx merged into one screen for mobile.
export default function EditWarehouseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const overviewQuery = useWarehousesOverview();
  const warehouse = useMemo(() => overviewQuery.data?.find((w) => w.id === id), [overviewQuery.data, id]);

  if (overviewQuery.isLoading || !warehouse) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  // Only mounts once the warehouse is found in the loaded overview list, so
  // its initial form state can be derived straight from props via useState's
  // lazy initializer below — same pattern as settings/general.tsx's
  // GeneralForm.
  return <WarehouseEditForm warehouseId={id} warehouse={warehouse} />;
}

function WarehouseEditForm({
  warehouseId,
  warehouse,
}: {
  warehouseId: string;
  warehouse: NonNullable<ReturnType<typeof useWarehousesOverview>['data']>[number];
}) {
  const id = warehouseId;
  const queryClient = useQueryClient();
  const profileQuery = useMyProfile();
  const overviewQuery = useWarehousesOverview();
  const teamQuery = useActiveTeamMembers();
  const productsQuery = useProductsInWarehouse(id);

  const canManage = isAdminRole(profileQuery.data?.role ?? '');
  const canTransfer = isManagerRole(profileQuery.data?.role ?? '');

  const [form, setForm] = useState<WarehouseInput>({
    name: warehouse.name,
    address: warehouse.address ?? '',
    country: warehouse.country ?? '',
    state: warehouse.state ?? '',
    phone: warehouse.phone ?? '',
    managerProfileId: warehouse.managerProfileId ?? undefined,
  });
  const [capacityText, setCapacityText] = useState(warehouse.capacity ? String(warehouse.capacity) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferProductId, setTransferProductId] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const managerOptions = useMemo(
    () => (teamQuery.data ?? []).map((m) => ({ label: `${m.name} (${m.role})`, value: m.id })),
    [teamQuery.data],
  );
  const otherWarehouseOptions = useMemo(
    () => (overviewQuery.data ?? []).filter((w) => w.id !== id && w.status === 'active').map((w) => ({ label: w.name, value: w.id })),
    [overviewQuery.data, id],
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['warehouses-overview'] });
    queryClient.invalidateQueries({ queryKey: ['warehouses'] });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateWarehouse(id, { ...form, capacity: capacityText ? Number(capacityText) : undefined });
      haptics.success();
      invalidate();
      router.back();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not update this branch.');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    try {
      if (warehouse.status === 'active') {
        await archiveWarehouse(id);
        haptics.success();
      } else {
        await reactivateWarehouse(id);
        haptics.success();
      }
      invalidate();
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not update this branch.');
    }
  }

  function handleDelete() {
    confirmAlert(`Delete "${warehouse.name}"?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWarehouse(id);
            haptics.success();
            router.back();
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not delete this branch.');
          }
        },
      },
    ]);
  }

  async function handleGenerateCode() {
    setCodeBusy(true);
    try {
      await generateBranchCode(id);
      haptics.success();
      invalidate();
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not generate a signup code.');
    } finally {
      setCodeBusy(false);
    }
  }

  function handleRevokeCode() {
    confirmAlert('Revoke this signup code?', 'Anyone still holding it will no longer be able to join this branch with it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          setCodeBusy(true);
          try {
            await revokeBranchCode(id);
            haptics.success();
            invalidate();
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not revoke the signup code.');
          } finally {
            setCodeBusy(false);
          }
        },
      },
    ]);
  }

  async function handleCopyCode() {
    if (!warehouse.branchCode) return;
    await Clipboard.setStringAsync(warehouse.branchCode);
    haptics.success();
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function handleTransfer() {
    if (!transferProductId || !transferTo) return;
    setTransferring(true);
    try {
      await transferWarehouseStock(transferProductId, transferTo);
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['products-in-warehouse', id] });
      invalidate();
      setTransferProductId(null);
      setTransferTo('');
    } catch (err) {
      haptics.warning();
      notifyAlert('Error', err instanceof Error ? err.message : 'Could not transfer this product.');
    } finally {
      setTransferring(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">{warehouse.name}</Text>
        <View className="w-12" />
      </View>

      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        {canManage ? (
          <>
            <TextField label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <TextField label="Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} multiline />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label="Country" value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} />
              </View>
              <View className="flex-1">
                <TextField label="State" value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} />
              </View>
            </View>
            <TextField label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
            <TextField label="Capacity in units" value={capacityText} onChangeText={setCapacityText} keyboardType="numeric" />
            <SelectField
              label="Branch manager"
              value={form.managerProfileId ?? ''}
              placeholder="No manager assigned"
              options={managerOptions}
              onChange={(v) => setForm({ ...form, managerProfileId: v })}
              searchable
            />

            {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

            <Button loading={saving} onPress={handleSave} className="mt-2">
              Save changes
            </Button>

            <View className="flex-row gap-2.5">
              <Button variant="secondary" onPress={handleArchiveToggle} className="flex-1">
                {warehouse.status === 'active' ? 'Archive' : 'Reactivate'}
              </Button>
              <Button variant="secondary" onPress={handleDelete} className="flex-1">
                Delete
              </Button>
            </View>

            <View className="mt-3 gap-2 rounded-[10px] border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[13px] font-bold text-text dark:text-text-dark">Signup code</Text>
              <Text className="text-[12px] text-muted dark:text-muted-dark">
                Anyone with this code can join this branch directly as a manager — no approval needed.
              </Text>
              {warehouse.branchCode ? (
                <>
                  <Pressable
                    onPress={handleCopyCode}
                    className="flex-row items-center justify-between rounded-[8px] border border-border bg-bg px-3 py-2.5 dark:border-border-dark dark:bg-bg-dark"
                  >
                    <Text className="font-mono text-[15px] font-bold tracking-widest text-text dark:text-text-dark">
                      {warehouse.branchCode}
                    </Text>
                    <Text className="text-[12px] font-semibold text-accent-text dark:text-accent-text-dark">
                      {codeCopied ? 'Copied' : 'Copy'}
                    </Text>
                  </Pressable>
                  <View className="flex-row gap-2.5">
                    <Button variant="secondary" loading={codeBusy} onPress={handleGenerateCode} className="flex-1">
                      Regenerate
                    </Button>
                    <Button variant="secondary" loading={codeBusy} onPress={handleRevokeCode} className="flex-1">
                      Revoke
                    </Button>
                  </View>
                </>
              ) : (
                <Button variant="secondary" loading={codeBusy} onPress={handleGenerateCode}>
                  Generate signup code
                </Button>
              )}
            </View>
          </>
        ) : (
          <Text className="text-[13px] text-muted dark:text-muted-dark">Only an owner or admin can edit branch details.</Text>
        )}

        {canTransfer && (
          <>
            <Text className="mt-3 text-[13px] font-bold text-text dark:text-text-dark">Products in this branch</Text>
            {productsQuery.isLoading ? (
              <ActivityIndicator />
            ) : (productsQuery.data ?? []).length === 0 ? (
              <Text className="text-[12.5px] text-muted dark:text-muted-dark">No products assigned here.</Text>
            ) : (
              (productsQuery.data ?? []).map((p) => (
                <View key={p.id} className="rounded-[10px] border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
                  <Text className="text-[12.5px] font-semibold text-text dark:text-text-dark">{p.name}</Text>
                  <Text className="text-[11px] text-muted dark:text-muted-dark">{p.sku} · {p.qtyOnHand} on hand</Text>
                  {transferProductId === p.id ? (
                    <View className="mt-2 gap-2">
                      <SelectField
                        value={transferTo}
                        placeholder="Move to branch…"
                        options={otherWarehouseOptions}
                        onChange={setTransferTo}
                      />
                      <View className="flex-row gap-2">
                        <Button variant="secondary" onPress={() => setTransferProductId(null)} className="flex-1">
                          Cancel
                        </Button>
                        <Button loading={transferring} disabled={!transferTo} onPress={handleTransfer} className="flex-1">
                          Confirm
                        </Button>
                      </View>
                    </View>
                  ) : (
                    <Pressable onPress={() => setTransferProductId(p.id)} className="mt-2 self-start">
                      <Text className="text-[12px] font-semibold text-accent-text dark:text-accent-text-dark">Move to another branch</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
