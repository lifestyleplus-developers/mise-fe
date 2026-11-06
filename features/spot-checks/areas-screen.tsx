import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { Area } from '@/shared/api/types';
import { EmptyState } from '@/shared/components/empty-state';
import {
  OutletPicker,
  useSelectedOutlet,
} from '@/shared/components/outlet-picker';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton, SkeletonRows } from '@/shared/components/skeleton';
import { SwitchTrack } from '@/shared/components/switch-row';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useRouter } from 'expo-router';
import { Archive, LayoutGrid, Plus } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { AreaSheet } from './area-sheet';
import { classifyAreaError, isArchivedUnsupported } from './area-errors';
import { usePlatformLimit, usePlatformLimits } from './platform-limits';
import { useAllAreas, useAreas, useSetAreaEligible } from './use-areas';
import { useSpotCheckOutlets } from './use-spot-check-outlets';

type AreaRowProps = {
  area: Area;
  first: boolean;
  readOnly: boolean;
  /** This row's switch did not save: it was put back, and the line says so. */
  failed: boolean;
  onOpen: () => void;
  onSwitch: (eligible: boolean) => void;
};

/** One area: its name (opens the sheet) and a switch that says what it does in words. */
function AreaRow({
  area,
  first,
  readOnly,
  failed,
  onOpen,
  onSwitch,
}: AreaRowProps) {
  const t = useT();
  const word = t(area.is_eligible ? 'spot.can-pick' : 'spot.not-picked');
  return (
    <View className={first ? undefined : 'border-border border-t'}>
      <View className="flex-row items-center">
        <Pressable
          accessibilityRole="button"
          disabled={readOnly}
          onPress={onOpen}
          className="active:bg-accent min-h-14 min-w-0 flex-1 justify-center py-2 pl-4"
        >
          <Text className="font-sans-medium text-[15px] leading-snug">
            {area.name}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={`${area.name}, ${word}`}
          accessibilityState={{ checked: area.is_eligible, disabled: readOnly }}
          disabled={readOnly}
          onPress={() => onSwitch(!area.is_eligible)}
          className="min-h-14 shrink-0 flex-row items-center gap-2.5 py-2 pr-4 pl-3 disabled:opacity-60"
        >
          <Text className="text-muted-foreground max-w-[6.5rem] text-right text-[12px] leading-tight">
            {word}
          </Text>
          <SwitchTrack checked={area.is_eligible} />
        </Pressable>
      </View>
      {failed ? (
        <Text
          accessibilityRole="alert"
          className="text-destructive-soft-foreground font-sans-medium px-4 pb-3 text-[13px] leading-snug"
        >
          {`${t('admin.save-failed')} ${t('common.offline')}`}
        </Text>
      ) : null}
    </View>
  );
}

/** Areas (SPT-06): the parts of an outlet a spot check can be drawn from. */
export function AreasScreen() {
  const t = useT();
  const router = useRouter();
  const { data: me } = useMe();
  const outlets = useSpotCheckOutlets();
  const [outlet, setOutletId] = useSelectedOutlet(outlets.outlets);
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const [sheet, setSheet] = React.useState<
    { kind: 'add' } | { kind: 'edit'; area: Area } | null
  >(null);
  const [showArchived, setShowArchived] = React.useState(false);
  // A write came back 403: read-only from here, as the platform now sees it.
  const [roleLost, setRoleLost] = React.useState(false);

  // A platform that will not list archived areas (SPT-06 `archivedFallback`) is
  // asked once, and not again: there is then nothing archived to show.
  const noArchived = usePlatformLimit('archivedAreas');
  const learn = usePlatformLimits((state) => state.learn);
  const query = useAreas(
    { outletId: outlet?.id, includeArchived: !noArchived },
    outlet !== undefined,
  );
  const archivedRefused = isArchivedUnsupported(query.error);
  React.useEffect(() => {
    if (archivedRefused) learn('archivedAreas');
  }, [archivedRefused, learn]);
  // Every live area, whatever has been scrolled to: "none can be picked" must be true.
  const live = useAllAreas(outlet?.id);
  const setEligible = useSetAreaEligible();
  const pull = usePullToRefresh(() => {
    void query.refetch();
    void live.refetch();
    outlets.refetch();
  });

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
  const areas = all.filter((area) => !area.is_archived);
  const archived = all.filter((area) => area.is_archived);
  const loading =
    outlets.isPending || (query.isPending && outlet !== undefined);
  const failed =
    (query.isError || outlets.isError) &&
    !forbidden &&
    !moduleOff &&
    !archivedRefused;
  const multiOutlet = outlets.outlets.length > 1;
  const noneEligible =
    live.isSuccess &&
    live.data.length > 0 &&
    live.data.every((area) => !area.is_eligible);
  const switchFailedFor =
    setEligible.isError && !forbidden ? setEligible.variables?.id : undefined;

  function loadMore() {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }

  function toggle(area: Area, next: boolean) {
    setEligible.mutate(
      { id: area.id, is_eligible: next },
      {
        onError: (caught) => {
          const kind = classifyAreaError(caught);
          if (kind === 'forbidden') setRoleLost(true);
          if (kind === 'gone') void query.refetch();
        },
      },
    );
  }

  const addButton = (
    <Button onPress={() => setSheet({ kind: 'add' })}>
      <Plus className="text-primary-foreground size-4" />
      <Text>{t('spot.add-area')}</Text>
    </Button>
  );

  let body: React.ReactNode;
  if (loading) {
    body = failed ? null : <SkeletonRows count={6} />;
  } else if (query.isError && all.length === 0) {
    body = null; // The Retry banner above says so.
  } else if (areas.length === 0 && archived.length === 0) {
    body = (
      <EmptyState
        icon={LayoutGrid}
        title={t('spot.empty-areas')}
        action={forbidden ? undefined : addButton}
      />
    );
  } else {
    body = (
      <>
        {areas.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title={t('spot.empty-areas')}
            action={forbidden ? undefined : addButton}
          />
        ) : (
          <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
            {areas.map((area, index) => (
              <AreaRow
                key={area.id}
                area={area}
                first={index === 0}
                readOnly={forbidden}
                failed={switchFailedFor === area.id}
                onOpen={() => setSheet({ kind: 'edit', area })}
                onSwitch={(next) => toggle(area, next)}
              />
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
        )}

        {archived.length > 0 ? (
          <View className="mx-4 mt-3">
            {showArchived ? (
              <View className="border-border bg-muted overflow-hidden rounded-3xl border">
                {archived.map((area, index) => (
                  <View
                    key={area.id}
                    className={`min-h-14 flex-row items-center gap-3 px-4 py-2 ${
                      index > 0 ? 'border-border border-t' : ''
                    }`}
                  >
                    <Text className="text-muted-foreground min-w-0 flex-1 text-[15px] leading-snug">
                      {area.name}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <Archive className="text-foreground size-4" />
                      <Text className="font-sans-semibold text-[13px]">
                        {t('spot.archived')}
                      </Text>
                    </View>
                  </View>
                ))}
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
      </>
    );
  }

  return (
    <PushedScreen
      title={t('spot.areas')}
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
          <Button size="sm" onPress={() => setSheet({ kind: 'add' })}>
            <Plus className="text-primary-foreground size-4" />
            <Text>{t('spot.add-area')}</Text>
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
              setEligible.reset();
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
          <Banner tone="error" message={t('spot.forbidden-areas')} />
        </View>
      ) : null}
      {noneEligible && !forbidden ? (
        <View className="mx-4 mb-3">
          <Banner tone="notice" message={t('spot.none-eligible')} />
        </View>
      ) : null}

      {body}

      {sheet && outlet ? (
        <AreaSheet
          key={sheet.kind === 'edit' ? sheet.area.id : 'new'}
          area={sheet.kind === 'edit' ? sheet.area : undefined}
          outletId={outlet.id}
          outletName={outlet.name}
          onClose={() => setSheet(null)}
          onLost={(kind) => {
            if (kind === 'forbidden') setRoleLost(true);
            else void query.refetch();
          }}
        />
      ) : null}
    </PushedScreen>
  );
}
