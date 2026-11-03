import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { SpotCheck, SpotCheckManager } from '@/shared/api/types';
import { EmptyState } from '@/shared/components/empty-state';
import {
  OutletPicker,
  useSelectedOutlet,
} from '@/shared/components/outlet-picker';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton, SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useRouter } from 'expo-router';
import {
  Archive,
  ChevronRight,
  ClipboardList,
  Plus,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { CheckManagers } from './check-managers';
import { useCheckText } from './check-text';
import { spotCheckEditHref } from './links';
import { useSpotChecks } from './use-spot-checks';
import { useSpotCheckOutlets } from './use-spot-check-outlets';

/** Checks (SPT-05, the list): an outlet's spot checks, and who is told when one is revealed. */
export function ChecksScreen() {
  const t = useT();
  const router = useRouter();
  const { data: me } = useMe();
  const text = useCheckText();
  const outlets = useSpotCheckOutlets();
  const [outlet, setOutletId] = useSelectedOutlet(outlets.outlets);
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const [showArchived, setShowArchived] = React.useState(false);
  const [roleLost, setRoleLost] = React.useState(false);
  const [managerCount, setManagerCount] = React.useState<number | null>(null);

  const query = useSpotChecks(
    { outletId: outlet?.id, includeArchived: true },
    outlet !== undefined,
  );
  const pull = usePullToRefresh(() => {
    void query.refetch();
    outlets.refetch();
  });
  const onKnown = React.useCallback(
    (managers: readonly SpotCheckManager[]) => setManagerCount(managers.length),
    [],
  );

  const status = query.error instanceof ApiError ? query.error.status : null;
  const forbidden = status === 403 || roleLost;
  const moduleOff =
    status === 404 ||
    (!outlets.isPending && !outlets.isError && outlets.outlets.length === 0);
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.spot-checks-off'), { outlet: me?.business.name ?? '' }),
    );
    router.replace('/modules');
  }, [moduleOff, me?.business.name, router, setModulesNotice, t]);

  const all = query.data?.pages.flatMap((page) => page.results) ?? [];
  const checks = all.filter((check) => !check.is_archived);
  const archived = all.filter((check) => check.is_archived);
  const loading =
    outlets.isPending || (query.isPending && outlet !== undefined);
  const failed = (query.isError || outlets.isError) && !forbidden && !moduleOff;
  const multiOutlet = outlets.outlets.length > 1;

  function newCheck() {
    if (!outlet) return;
    router.push({
      pathname: '/spot-checks/checks/new',
      params: { outlet: String(outlet.id) },
    });
  }

  function loadMore() {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }

  const newButton = (
    <Button onPress={newCheck}>
      <Plus className="text-primary-foreground size-4" />
      <Text>{t('spot.new-check')}</Text>
    </Button>
  );

  const openRow = (check: SpotCheck, index: number, muted = false) => {
    const rowClass = `min-h-16 flex-row items-center gap-3 px-4 py-3 ${
      index > 0 ? 'border-border border-t' : ''
    }`;
    const content = (
      <>
        <View className="min-w-0 flex-1">
          <Text
            className={`font-sans-semibold text-[16px] leading-snug ${
              muted ? 'text-muted-foreground' : ''
            }`}
          >
            {check.name}
          </Text>
          <Text className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
            {text.line(check)}
          </Text>
          <Text className="mt-0.5 text-[13px] leading-snug">
            {text.counts(check)}
          </Text>
        </View>
        {muted ? (
          <View className="flex-row items-center gap-1">
            <Archive className="text-foreground size-4" />
            <Text className="font-sans-semibold text-[13px]">
              {t('spot.archived')}
            </Text>
          </View>
        ) : (
          <ChevronRight className="text-muted-foreground size-5 shrink-0" />
        )}
      </>
    );
    // An archived check is frozen, so its row does not open.
    return muted ? (
      <View key={check.id} className={rowClass}>
        {content}
      </View>
    ) : (
      <Pressable
        key={check.id}
        accessibilityRole="button"
        onPress={() => router.push(spotCheckEditHref(check.id))}
        className={`active:bg-accent ${rowClass}`}
      >
        {content}
      </Pressable>
    );
  };

  let body: React.ReactNode;
  if (loading) {
    body = failed ? null : <SkeletonRows count={3} />;
  } else if (query.isError && all.length === 0) {
    body = null; // The Retry banner above says so.
  } else if (checks.length === 0) {
    body = (
      <EmptyState
        icon={ClipboardList}
        title={t('spot.empty-checks')}
        action={forbidden ? undefined : newButton}
      />
    );
  } else {
    body = (
      <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
        {checks.map((check, index) => openRow(check, index))}
        {query.isFetchingNextPage ? (
          <View className="border-border min-h-16 gap-2 border-t px-4 py-3">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <PushedScreen
      title={t('spot.checks')}
      eyebrow={
        multiOutlet && outlet
          ? format(t('spot.eyebrow'), { outlet: outlet.name })
          : t('modules.spot-checks')
      }
      adminOnly
      backHref="/spot-checks"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
      onEndReached={loadMore}
      action={
        forbidden || loading || !outlet ? undefined : (
          <Button size="sm" onPress={newCheck}>
            <Plus className="text-primary-foreground size-4" />
            <Text>{t('spot.new-check')}</Text>
          </Button>
        )
      }
    >
      {multiOutlet && outlet ? (
        <View className="mx-4 mb-3">
          <OutletPicker
            outlets={outlets.outlets}
            value={outlet.id}
            onChange={(id) => {
              setOutletId(id);
              setShowArchived(false);
              setManagerCount(null);
            }}
          />
        </View>
      ) : null}

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
      {failed && all.length > 0 ? (
        <Text className="mx-5 mb-3 text-[13px] leading-snug">
          {t('spot.cached')}
        </Text>
      ) : null}
      {forbidden ? (
        <View className="mx-4 mb-3">
          <Banner tone="error" message={t('spot.forbidden-edit')} />
        </View>
      ) : null}

      <View className="border-input-edge bg-card mx-4 mb-3 rounded-2xl border border-dashed px-4 py-3">
        <Text className="font-sans-bold text-[14px] leading-snug">
          {t('spot.placeholder-title')}
        </Text>
        <Text className="mt-0.5 text-[14px] leading-snug">
          {t('spot.placeholder-body')}
        </Text>
      </View>

      {checks.length > 0 && managerCount === 0 ? (
        <View className="mx-4 mb-3">
          <Banner tone="notice" message={t('spot.no-managers')} />
        </View>
      ) : null}

      {body}

      {outlet && !loading && !forbidden ? (
        <CheckManagers
          key={outlet.id}
          outletId={outlet.id}
          disabled={forbidden}
          onKnown={onKnown}
          onLocked={() => setRoleLost(true)}
        />
      ) : null}

      {archived.length > 0 ? (
        <View className="mx-4 mt-4">
          {showArchived ? (
            <View className="border-border bg-muted overflow-hidden rounded-3xl border">
              {archived.map((check, index) => openRow(check, index, true))}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowArchived(true)}
              className="min-h-11 justify-center px-1"
            >
              <Text className="font-sans-semibold text-[14px] underline">
                {t('spot.show-archived')}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </PushedScreen>
  );
}
