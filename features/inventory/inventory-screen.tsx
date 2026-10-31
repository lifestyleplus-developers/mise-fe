import { useFormatQuantity } from '@/features/inventory/format';
import { ItemSheet } from '@/features/inventory/item-sheet';
import { ManagersSheet } from '@/features/inventory/managers-sheet';
import { useInventoryItems } from '@/features/inventory/use-inventory-items';
import { useInventoryManagers } from '@/features/inventory/use-inventory-managers';
import { useInventoryOutlets } from '@/features/inventory/use-inventory-outlets';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { InventoryItem } from '@/shared/api/types';
import { AutoDismissBanner } from '@/shared/components/auto-dismiss-banner';
import { EmptyState } from '@/shared/components/empty-state';
import {
  OutletPicker,
  useSelectedOutlet,
} from '@/shared/components/outlet-picker';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SearchField } from '@/shared/components/search-field';
import { Skeleton, SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useRouter } from 'expo-router';
import {
  ChartColumn,
  ChevronRight,
  Info,
  Package,
  Plus,
  UserCog,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/** Inventory (INV-01): an outlet's items and what is left of each. */
export function InventoryScreen() {
  const t = useT();
  const router = useRouter();
  const formatQuantity = useFormatQuantity();
  const outlets = useInventoryOutlets();
  const [outlet, setOutletId] = useSelectedOutlet(outlets.outlets);
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const [search, setSearch] = React.useState('');
  const [sheet, setSheet] = React.useState<
    { kind: 'add' } | { kind: 'edit'; item: InventoryItem } | null
  >(null);
  const [managersOpen, setManagersOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<{
    id: number;
    text: string;
  } | null>(null);

  const query = useInventoryItems(
    {
      outletId: outlet?.id,
      search: useDebouncedValue(search.trim()),
      includeArchived: false,
    },
    outlet !== undefined,
  );
  const managers = useInventoryManagers(
    outlet?.id ?? 0,
    outlets.admin && outlet !== undefined,
  );
  const pull = usePullToRefresh(() => {
    void query.refetch();
    outlets.refetch();
  });

  const status = query.error instanceof ApiError ? query.error.status : null;
  const forbidden = status === 403;
  const moduleOff =
    status === 404 ||
    (!outlets.isPending && !outlets.isError && outlets.outlets.length === 0);
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(t('modules.inventory-off'));
    router.replace('/modules');
  }, [moduleOff, router, setModulesNotice, t]);

  const items = query.data?.pages.flatMap((page) => page.results) ?? [];
  const searching = search.trim().length > 0;
  const loading =
    outlets.isPending || (query.isPending && outlet !== undefined);
  const failed = (query.isError || outlets.isError) && !forbidden && !moduleOff;
  const managerNames = (managers.data ?? []).map((m) => m.full_name);

  function loadMore() {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }

  function tell(text: string) {
    setNotice({ id: Date.now(), text });
  }

  let body: React.ReactNode;
  if (forbidden) {
    body = (
      <View className="mx-4">
        <Banner tone="error" message={t('inv.not-yours-read')} />
      </View>
    );
  } else if (loading) {
    body = failed ? null : <SkeletonRows count={7} />;
  } else if (query.isError && items.length === 0) {
    body = null; // The Retry banner above says so.
  } else if (items.length === 0) {
    body = searching ? (
      <Text className="mx-5 mt-2 text-[15px] leading-snug">
        {format(t('inv.no-match'), { q: search.trim() })}
      </Text>
    ) : (
      <EmptyState
        icon={Package}
        title={t('inv.empty')}
        body={outlets.admin ? undefined : t('inv.empty-manager-body')}
      />
    );
  } else {
    body = (
      <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
        {items.map((item, index) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/inventory/[id]',
                params: { id: item.id, outlet: item.outlet_id },
              })
            }
            className={`active:bg-accent min-h-14 flex-row items-center gap-3 px-4 py-2.5 ${
              index > 0 ? 'border-border border-t' : ''
            }`}
          >
            <Text className="font-sans-medium min-w-0 flex-1 text-[15px] leading-snug">
              {item.name}
            </Text>
            <View className="shrink-0 items-end">
              <Text className="font-sans-semibold text-[15px]">
                {formatQuantity(item.balance, item.unit)}
              </Text>
              {item.balance < 0 ? (
                <View className="flex-row items-center gap-1">
                  <Info className="text-warning-soft-foreground size-3.5" />
                  <Text className="text-warning-soft-foreground font-sans-semibold text-[12px]">
                    {t('inv.below-zero')}
                  </Text>
                </View>
              ) : null}
            </View>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Pressable>
        ))}
        {query.isFetchingNextPage
          ? [0, 1].map((key) => (
              <View
                key={key}
                className="border-border min-h-14 flex-row items-center gap-3 border-t px-4 py-3"
              >
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="ml-auto h-3.5 w-1/5" />
              </View>
            ))
          : null}
      </View>
    );
  }

  return (
    <PushedScreen
      title={t('modules.inventory')}
      backHref="/modules"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
      onEndReached={loadMore}
      action={
        <Button
          variant="outline"
          size="sm"
          onPress={() => router.push('/inventory/reports')}
        >
          <ChartColumn className="text-foreground size-4" />
          <Text>{t('inv.reports')}</Text>
        </Button>
      }
      footer={
        outlets.admin && outlet && !forbidden && !loading ? (
          <Button className="w-full" onPress={() => setSheet({ kind: 'add' })}>
            <Plus className="text-primary-foreground size-5" />
            <Text>{t('inv.add')}</Text>
          </Button>
        ) : undefined
      }
    >
      {forbidden ? null : (
        <View className="mx-4 mb-3 gap-3">
          <OutletPicker
            outlets={outlets.outlets}
            value={outlet?.id ?? 0}
            onChange={(id) => {
              setOutletId(id);
              setSearch('');
              setNotice(null);
            }}
          />
        </View>
      )}

      {failed ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void query.refetch();
            outlets.refetch();
          }}
          retrying={query.isRefetching || outlets.isRefetching}
        />
      ) : null}
      {failed && items.length > 0 ? (
        <Text className="mx-5 mb-3 text-[13px] leading-snug">
          {t('inv.cached')}
        </Text>
      ) : null}
      {notice ? (
        <View className="mx-4 mb-3">
          <AutoDismissBanner
            key={notice.id}
            tone="notice"
            message={notice.text}
            duration={6000}
            onDismiss={() => setNotice(null)}
          />
        </View>
      ) : null}

      {outlets.admin && outlet && !forbidden && !loading ? (
        <View className="mx-4 mb-3">
          <Pressable
            accessibilityRole="button"
            onPress={() => setManagersOpen(true)}
            className="shadow-card border-border bg-card active:bg-accent min-h-14 flex-row items-center gap-3 rounded-3xl border px-4 py-2"
          >
            <UserCog className="text-foreground size-5 shrink-0" />
            <Text className="min-w-0 flex-1 text-[15px] leading-snug">
              <Text className="font-sans-medium text-[15px]">
                {t('inv.managers')}
              </Text>
              {managers.isSuccess ? (
                <Text className="text-[15px]">
                  {' · '}
                  <Text className="font-sans-semibold text-[15px]">
                    {managerNames.length === 0
                      ? t('inv.none')
                      : managerNames.length > 2
                        ? `${managerNames.slice(0, 2).join(', ')} +${managerNames.length - 2}`
                        : managerNames.join(', ')}
                  </Text>
                </Text>
              ) : null}
            </Text>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Pressable>
        </View>
      ) : null}

      {!loading &&
      !forbidden &&
      !(failed && items.length === 0) &&
      (items.length > 0 || searching) ? (
        <View className="mx-4 mb-3">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t('inv.search')}
            clearLabel={t('att.clear')}
          />
        </View>
      ) : null}

      {body}

      {sheet && outlet ? (
        <ItemSheet
          key={sheet.kind === 'edit' ? sheet.item.id : 'new'}
          item={sheet.kind === 'edit' ? sheet.item : undefined}
          outletId={outlet.id}
          outletName={outlet.name}
          multiOutlet={outlets.outlets.length > 1}
          onClose={() => setSheet(null)}
          onAdded={(item) => {
            setSheet(null);
            tell(format(t('inv.added'), { name: item.name }));
          }}
          onArchived={(item) => {
            setSheet(null);
            tell(format(t('inv.archived'), { name: item.name }));
          }}
          onLost={() => void query.refetch()}
        />
      ) : null}
      {managersOpen && outlet ? (
        <ManagersSheet
          outletId={outlet.id}
          outletName={outlet.name}
          onClose={() => setManagersOpen(false)}
        />
      ) : null}
    </PushedScreen>
  );
}
