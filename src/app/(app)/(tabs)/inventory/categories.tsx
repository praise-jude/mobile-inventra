import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { PlaceholderTextColor } from '@/constants/theme';
import { createCategory, deleteCategory, updateCategory } from '@/lib/actions/categories';
import { confirmAlert, notifyAlert } from '@/lib/confirm';
import { FLATLIST_PERF_PROPS } from '@/lib/flatlist-perf';
import { haptics } from '@/lib/haptics';
import { useCategoriesDetailed, type CategoryDetailRow } from '@/lib/hooks/use-categories';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { isManagerRole } from '@/lib/roles';
import { useQueryClient } from '@tanstack/react-query';

// Mirrors Inventra/components/categories/CategoriesClient.tsx — a single
// page with an inline add/edit sheet instead of a separate route, since
// categories are a small entity (name + emoji only).
export default function CategoriesScreen() {
  const queryClient = useQueryClient();
  const profileQuery = useMyProfile();
  const query = useCategoriesDetailed();
  const canManage = isManagerRole(profileQuery.data?.role ?? '');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CategoryDetailRow | null | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['categories-detailed'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!q) return rows;
    return rows.filter((c) => c.name.toLowerCase().includes(q));
  }, [query.data, search]);

  function handleDelete(category: CategoryDetailRow) {
    confirmAlert(`Delete "${category.name}"?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(category.id);
          try {
            await deleteCategory(category.id);
            haptics.success();
            invalidate();
          } catch (err) {
            haptics.warning();
            notifyAlert('Error', err instanceof Error ? err.message : 'Could not delete the category.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Categories</Text>
        <View className="w-12" />
      </View>

      <View className="gap-2.5 p-4">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search categories…"
          placeholderTextColor={PlaceholderTextColor}
          className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />
        {canManage && (
          <Button onPress={() => setEditing(null)} className="self-start px-4">
            + New category
          </Button>
        )}
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[56px] w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🗂️" title="No categories" description="Add a category to start organizing your products." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          {...FLATLIST_PERF_PROPS}
          contentContainerClassName="gap-2 px-4 pb-6"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                <Text className="text-[16px]">{item.emoji || '📦'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{item.name}</Text>
                <Text className="text-[11.5px] text-muted dark:text-muted-dark">
                  {item.productCount} product{item.productCount === 1 ? '' : 's'}
                </Text>
              </View>
              {canManage && (
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setEditing(item)}
                    className="rounded-[8px] border border-border px-2.5 py-1.5 dark:border-border-dark"
                  >
                    <Text className="text-[12px] font-semibold text-text dark:text-text-dark">Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(item)}
                    disabled={busyId === item.id}
                    className="rounded-[8px] border border-border px-2.5 py-1.5 dark:border-border-dark"
                  >
                    <Text className="text-[12px] font-semibold text-red dark:text-red-dark">Delete</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}

      {editing !== undefined && (
        <CategorySheet category={editing ?? undefined} onClose={() => setEditing(undefined)} onSaved={invalidate} />
      )}
    </SafeAreaView>
  );
}

function CategorySheet({
  category,
  onClose,
  onSaved,
}: {
  category?: CategoryDetailRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState(category?.emoji ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (category) {
        await updateCategory(category.id, { name, emoji });
      } else {
        await createCategory({ name, emoji });
      }
      haptics.success();
      onSaved();
      onClose();
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not save this category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Pressable onPress={onClose} className="absolute inset-0 items-end justify-end bg-black/40">
      <Pressable onPress={(e) => e.stopPropagation()} className="w-full rounded-t-[20px] bg-surface p-5 pb-8 dark:bg-surface-dark">
        <Text className="mb-4 text-[15px] font-bold text-text dark:text-text-dark">
          {category ? 'Edit category' : 'New category'}
        </Text>
        <View className="gap-3">
          <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Beverages" autoFocus />
          <TextField label="Emoji (optional)" value={emoji} onChangeText={setEmoji} placeholder="📦" maxLength={4} />
          {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}
          <Button loading={saving} onPress={handleSave} className="mt-1">
            Save
          </Button>
        </View>
      </Pressable>
    </Pressable>
  );
}
