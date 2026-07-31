import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { Button } from '@/components/ui/button';
import { FLATLIST_PERF_PROPS } from '@/lib/flatlist-perf';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { useSuppliersDetailed } from '@/lib/hooks/use-suppliers';
import { isManagerRole } from '@/lib/roles';

// Mirrors Inventra/components/suppliers/SuppliersClient.tsx.
export default function SuppliersScreen() {
  const profileQuery = useMyProfile();
  const query = useSuppliersDetailed();
  const canManage = isManagerRole(profileQuery.data?.role ?? '');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!q) return rows;
    return rows.filter((s) => s.name.toLowerCase().includes(q) || (s.company ?? '').toLowerCase().includes(q));
  }, [query.data, search]);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Suppliers</Text>
        <View className="w-12" />
      </View>

      <View className="gap-2.5 p-4">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search suppliers…"
          placeholderTextColor="#aab2c4"
          className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />
        {canManage && (
          <Button onPress={() => router.push('/inventory/suppliers/new')} className="self-start px-4">
            + New supplier
          </Button>
        )}
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🚚" title="No suppliers" description="Add a supplier to track where your stock comes from." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          {...FLATLIST_PERF_PROPS}
          contentContainerClassName="gap-2 px-4 pb-6"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/inventory/suppliers/${item.id}`)}
              className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark"
            >
              <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">{item.name}</Text>
              {item.company && <Text className="text-[12px] text-muted dark:text-muted-dark">{item.company}</Text>}
              <Text className="mt-1 text-[11.5px] text-text-2 dark:text-text-2-dark">
                {item.productCount} product{item.productCount === 1 ? '' : 's'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
