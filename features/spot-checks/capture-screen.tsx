import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import { EmptyState } from '@/shared/components/empty-state';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SkeletonRows } from '@/shared/components/skeleton';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { format, useT } from '@/shared/i18n';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarClock, ClipboardList, ScanSearch } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { landingKind } from './capture-view';
import { spotCheckCaptureHref } from './links';
import { RunPage } from './run-page';
import { SpotCheckLinks } from './spot-check-links';
import { useSpotCheckRuns } from './use-spot-check-runs';
import { useSpotChecks } from './use-spot-checks';

/**
 * The Spot checks entry (SPT-01), the same for every role. A link to a run
 * (`?run=ID`, from a "check revealed" notification) opens that run. Otherwise: one
 * revealed check is shown at once, two or more as a list, none as the next one
 * scheduled, which is only its name (🔒 not its subject, not its time).
 */
export function CaptureScreen() {
  const { run } = useLocalSearchParams<{ run?: string }>();
  if (run !== undefined) {
    return <RunPage runId={Number(run)} backHref="/modules" />;
  }
  return <Landing />;
}

function Landing() {
  const t = useT();
  const router = useRouter();
  const formatClock = useFormatClock();
  const { data: me } = useMe();
  const setModulesNotice = useModulesNotice((state) => state.setNotice);
  const admin = me ? canAdminister(me.user.tenant_role) : false;

  const revealed = useSpotCheckRuns({ state: 'revealed' }, me !== undefined);
  const scheduled = useSpotCheckRuns({ state: 'scheduled' }, me !== undefined);
  // Only head office is told "no spot checks are set up", so only it asks.
  const checks = useSpotChecks({ includeArchived: false }, admin);
  const pull = usePullToRefresh(() => {
    void revealed.refetch();
    void scheduled.refetch();
    void checks.refetch();
  });

  const status =
    revealed.error instanceof ApiError ? revealed.error.status : null;
  const moduleOff = status === 404;
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.spot-checks-off'), { outlet: me?.business.name ?? '' }),
    );
    router.replace('/modules');
  }, [moduleOff, me?.business.name, router, setModulesNotice, t]);

  const openRuns = revealed.data?.pages.flatMap((page) => page.results) ?? [];
  const nextScheduled = scheduled.data?.pages.flatMap(
    (page) => page.results,
  )[0];
  const loading =
    !me ||
    revealed.isPending ||
    scheduled.isPending ||
    (admin && checks.isPending);
  const failed = revealed.isError && !moduleOff;

  if (!loading && !failed) {
    const kind = landingKind({
      revealed: openRuns.length,
      scheduled: scheduled.data?.pages[0]?.count ?? 0,
      admin,
      checkCount: checks.data?.pages[0]?.count ?? 0,
    });
    if (kind === 'run') {
      return (
        <RunPage
          key={openRuns[0].id}
          runId={openRuns[0].id}
          backHref="/modules"
        />
      );
    }

    return (
      <PushedScreen
        title={t('modules.spot-checks')}
        backHref="/modules"
        onRefresh={pull.onRefresh}
        refreshing={pull.refreshing}
      >
        <SpotCheckLinks />
        {kind === 'list' ? (
          <View className="gap-3">
            {openRuns.map((open) => (
              <Pressable
                key={open.id}
                accessibilityRole="button"
                onPress={() => router.push(spotCheckCaptureHref(open.id))}
                className="shadow-card border-border bg-card active:bg-accent mx-4 min-h-16 rounded-3xl border px-4 py-3"
              >
                <Text className="font-sans-semibold text-[16px] leading-snug">
                  {open.spot_check_name}
                </Text>
                <Text className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
                  {format(t('spot.closes-at'), {
                    time: open.window_close
                      ? formatClock(isoToClock(open.window_close))
                      : '',
                  })}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : kind === 'scheduled' && nextScheduled ? (
          <View className="border-border bg-card mx-4 rounded-3xl border border-dashed px-4 py-4">
            <View className="flex-row items-center gap-2">
              <CalendarClock className="text-muted-foreground size-5 shrink-0" />
              <Text className="text-muted-foreground min-w-0 flex-1 text-[15px] leading-snug font-semibold">
                {format(t('spot.scheduled'), {
                  name: nextScheduled.spot_check_name,
                })}
              </Text>
            </View>
          </View>
        ) : kind === 'noChecks' ? (
          <EmptyState
            icon={ClipboardList}
            title={t('spot.no-checks')}
            action={
              <Button
                variant="outline"
                onPress={() => router.push('/spot-checks/checks')}
              >
                <ClipboardList className="text-foreground size-4" />
                <Text>{t('spot.checks')}</Text>
              </Button>
            }
          />
        ) : (
          <EmptyState icon={ScanSearch} title={t('spot.nothing')} />
        )}
      </PushedScreen>
    );
  }

  return (
    <PushedScreen
      title={t('modules.spot-checks')}
      backHref="/modules"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
    >
      {failed ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void revealed.refetch();
            void scheduled.refetch();
          }}
          retrying={revealed.isRefetching}
        />
      ) : (
        <SkeletonRows count={4} />
      )}
    </PushedScreen>
  );
}
