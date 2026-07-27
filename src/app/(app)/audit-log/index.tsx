import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { PremiumLockedState } from '@/components/premium-locked-state';
import { Skeleton } from '@/components/skeleton';
import { SelectField } from '@/components/ui/select-field';
import { FLATLIST_PERF_PROPS } from '@/lib/flatlist-perf';
import { useAuditLogs, useAuditModules, type AuditLogRow } from '@/lib/hooks/use-audit-log';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useEntitlements } from '@/lib/hooks/use-entitlements';
import { useMyProfile } from '@/lib/hooks/use-my-profile';
import { isAdminRole } from '@/lib/roles';

function describe(row: AuditLogRow): string {
  return `${row.action}${row.entityLabel ? ` · ${row.entityLabel}` : ''}`;
}

// Mirrors Inventra/components/audit/AuditLogClient.tsx — free-text search
// and module/date filters, no CSV export (mobile has no file-sharing-
// friendly CSV writer wired up yet). audit_logs_select RLS is admin-only;
// this screen's isAdminRole gate is UX only, RLS is the real boundary.
export default function AuditLogScreen() {
  const profileQuery = useMyProfile();
  const entitlementsQuery = useEntitlements();
  const isAdmin = isAdminRole(profileQuery.data?.role ?? '');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [module, setModule] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const modulesQuery = useAuditModules();
  const query = useAuditLogs({
    search: debouncedSearch || undefined,
    module: module || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const moduleOptions = useMemo(
    () => [{ label: 'All modules', value: '' }, ...(modulesQuery.data ?? []).map((m) => ({ label: m, value: m }))],
    [modulesQuery.data],
  );

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);

  if (profileQuery.data && !isAdmin) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark px-8">
        <Text className="text-center text-[13.5px] text-muted dark:text-muted-dark">Only an owner or admin can view the audit log.</Text>
      </SafeAreaView>
    );
  }

  if (entitlementsQuery.data && entitlementsQuery.data.tier !== 'premium') {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <PremiumLockedState feature="The audit log" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Audit Log</Text>
        <View className="w-12" />
      </View>

      <View className="gap-2.5 p-4">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by actor, action, or entity…"
          placeholderTextColor="#aab2c4"
          className="h-[42px] rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />
        <SelectField value={module} placeholder="All modules" options={moduleOptions} onChange={setModule} searchable />
        <View className="flex-row gap-2.5">
          <TextInput
            value={dateFrom}
            onChangeText={setDateFrom}
            placeholder="From (YYYY-MM-DD)"
            placeholderTextColor="#aab2c4"
            className="h-[42px] flex-1 rounded-[9px] border border-border bg-surface px-[13px] text-[13px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
          <TextInput
            value={dateTo}
            onChangeText={setDateTo}
            placeholder="To (YYYY-MM-DD)"
            placeholderTextColor="#aab2c4"
            className="h-[42px] flex-1 rounded-[9px] border border-border bg-surface px-[13px] text-[13px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </View>
      </View>

      {query.isLoading ? (
        <View className="gap-2.5 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] w-full" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon="🛡️" title="No activity found" description="Try a different search term or module." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          {...FLATLIST_PERF_PROPS}
          contentContainerClassName="gap-2 px-4 pb-6"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          onEndReached={() => {
            if (query.hasNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator className="py-4" /> : null}
          renderItem={({ item }) => (
            <View className="rounded-2xl border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark">
              <View className="flex-row items-center justify-between">
                <Text className="text-[12.5px] font-semibold text-text dark:text-text-dark">{describe(item)}</Text>
                <View className="rounded-full bg-accent-weak px-2 py-0.5 dark:bg-accent-weak-dark">
                  <Text className="text-[10px] font-bold text-accent-text dark:text-accent-text-dark">{item.module}</Text>
                </View>
              </View>
              <Text className="mt-1 text-[11.5px] text-muted dark:text-muted-dark">
                {item.actorName} ({item.actorRole}) · {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
