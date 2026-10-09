import { useMe } from '@/features/auth/use-me';
import { InactiveBadge } from '@/features/users/inactive-badge';
import { isForbidden } from '@/features/users/user-errors';
import { AddUserSheet } from '@/features/users/user-sheets';
import { useUsers } from '@/features/users/use-users';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { Avatar } from '@/shared/components/avatar';
import { AutoDismissBanner } from '@/shared/components/auto-dismiss-banner';
import { EmptyState } from '@/shared/components/empty-state';
import { FilterChips } from '@/shared/components/filter-chips';
import { NewButton } from '@/shared/components/new-button';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SearchField } from '@/shared/components/search-field';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { Skeleton, SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { ROLE, type Role } from '@/shared/constants/roles';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { cn } from '@/shared/lib/utils';
import { useRouter } from 'expo-router';
import { ChevronRight, Search, Users } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type Status = 'active' | 'inactive';

/** Users list (ADM-02): search, filter, add, open to edit. */
export function UsersScreen() {
  const t = useT();
  const router = useRouter();
  const { data: me } = useMe();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<Status>('active');
  const [role, setRole] = React.useState<'all' | Role>('all');
  const [adding, setAdding] = React.useState(false);
  const [added, setAdded] = React.useState<{
    id: number;
    name: string;
    username: string;
  } | null>(null);

  const query = useUsers({
    role: role === 'all' ? undefined : role,
    isActive: status === 'active',
    search: useDebouncedValue(search.trim()),
  });

  if (!me) return null;

  const users = query.data?.pages.flatMap((page) => page.results) ?? [];
  const forbidden = query.isError && isForbidden(query.error);
  const filtered = status !== 'active' || role !== 'all';

  function loadMore() {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }

  function openAdd() {
    setAdded(null);
    setAdding(true);
  }

  return (
    <PushedScreen
      title={t('more.users')}
      adminOnly
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onEndReached={loadMore}
      action={<NewButton onPress={openAdd} />}
    >
      {forbidden ? (
        <View className="mx-4">
          <Banner tone="error" message={t('admin.no-access')} />
        </View>
      ) : (
        <>
          <View className="mx-4 mb-3 gap-3">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={t('users.search')}
              clearLabel={t('users.clear')}
            />
            <SegmentedControl
              label={t('users.status')}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'active', label: t('users.active') },
                { value: 'inactive', label: t('users.inactive') },
              ]}
            />
            <FilterChips
              label={t('users.role-filter')}
              value={role}
              onChange={setRole}
              options={[
                { value: 'all', label: t('users.all') },
                ...[ROLE.OWNER, ROLE.ADMIN, ROLE.MEMBER].map((value) => ({
                  value,
                  label: t(`role.${value}` as MessageKey),
                })),
              ]}
            />
          </View>

          {query.isError ? (
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void query.refetch()}
              retrying={query.isRefetching}
            />
          ) : null}
          {added ? (
            <View className="mx-4 mb-3">
              <AutoDismissBanner
                key={added.id}
                tone="notice"
                message={format(t('users.added-notice'), {
                  name: added.name,
                  username: added.username,
                })}
                onDismiss={() => setAdded(null)}
              />
            </View>
          ) : null}

          {query.isPending ? (
            <SkeletonRows count={5} avatar />
          ) : users.length === 0 ? (
            search.trim() ? (
              <EmptyState
                icon={Search}
                title={format(t('users.no-match'), { q: search.trim() })}
                action={
                  <Button variant="outline" onPress={() => setSearch('')}>
                    <Text>{t('users.clear')}</Text>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                title={t('users.no-one-here')}
                action={
                  filtered ? (
                    <Button
                      variant="outline"
                      onPress={() => {
                        setStatus('active');
                        setRole('all');
                      }}
                    >
                      <Text>{t('users.clear-filters')}</Text>
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : (
            <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
              {users.map((user, index) => (
                <Pressable
                  key={user.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setAdded(null);
                    router.push(`/users/${user.id}`);
                  }}
                  className={cn(
                    'active:bg-accent min-h-16 flex-row items-center gap-3 px-4 py-2.5',
                    index > 0 && 'border-border border-t',
                  )}
                >
                  <Avatar name={user.full_name} />
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans-semibold text-[15px]">
                      {user.full_name}
                    </Text>
                    <Text className="text-muted-foreground text-[13px]">
                      @{user.username} · {t(`role.${user.role}` as MessageKey)}
                    </Text>
                  </View>
                  {user.is_active ? null : <InactiveBadge />}
                  <ChevronRight className="text-muted-foreground size-5 shrink-0" />
                </Pressable>
              ))}
              {query.isFetchingNextPage
                ? [0, 1].map((key) => (
                    <View
                      key={key}
                      className="border-border min-h-16 flex-row items-center gap-3 border-t px-4 py-2.5"
                    >
                      <Skeleton className="size-10" />
                      <View className="flex-1 gap-2">
                        <Skeleton className="h-3.5 w-2/5" />
                        <Skeleton className="h-3 w-1/4" />
                      </View>
                    </View>
                  ))
                : null}
            </View>
          )}
        </>
      )}

      <AddUserSheet
        visible={adding}
        viewer={{ id: me.user.id, role: me.user.role }}
        onClose={() => setAdding(false)}
        onAdded={(user) =>
          setAdded({
            id: user.id,
            name: user.full_name,
            username: user.username,
          })
        }
      />
    </PushedScreen>
  );
}
