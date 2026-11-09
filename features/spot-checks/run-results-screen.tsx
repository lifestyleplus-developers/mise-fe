import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { SpotCheckResult, SpotCheckRunCapture } from '@/shared/api/types';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useRouter } from 'expo-router';
import { Flag } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

import { OverrideSheet } from './override-sheet';
import { PhotoTile } from './photo-tile';
import { ResultRow } from './result-row';
import { SpotCheckLinks } from './spot-check-links';
import { closedSummary } from './capture-view';
import { closedLine } from './closed-line';
import { usePlatformLimit } from './platform-limits';
import { subjectName } from './spot-outcome';
import { useSpotCheckOutlets } from './use-spot-check-outlets';
import { useSpotCheckRun } from './use-spot-check-runs';

type RunResultsScreenProps = {
  runId: number;
};

/** The photographs this run holds, as the review screen shows them: read-only. */
function captureTiles(
  capture: SpotCheckRunCapture,
  t: ReturnType<typeof useT>,
  time: (iso: string) => string,
) {
  const tiles: React.ReactNode[] = [];
  const photo = capture.photo;
  const earlier = capture.earlier_photos[capture.earlier_photos.length - 1];
  if (!photo) {
    tiles.push(
      <PhotoTile
        key={`${capture.position}-missing`}
        kind="missing"
        label={t('spot.not-taken')}
        sub={capture.prompt}
      />,
    );
  } else {
    const purged = photo.purged_at !== null;
    tiles.push(
      <PhotoTile
        key={`${capture.position}-photo`}
        kind={purged ? 'purged' : 'photo'}
        label={
          purged
            ? t('spot.purged')
            : format(t('spot.by-at'), {
                name: photo.captured_by.full_name,
                time: time(photo.captured_at),
              })
        }
        sub={capture.prompt}
        uri={photo.image_url}
      />,
    );
    if (earlier) {
      const earlierPurged = earlier.purged_at !== null;
      tiles.push(
        <PhotoTile
          key={`${capture.position}-earlier`}
          kind={earlierPurged ? 'purged' : 'replaced'}
          label={
            earlierPurged
              ? t('spot.purged')
              : format(t('spot.replaced'), {
                  name: earlier.captured_by.full_name,
                  time: time(earlier.captured_at),
                })
          }
          uri={earlier.image_url}
        />,
      );
    }
  }
  return tiles;
}

/**
 * One run's results and review (SPT-03): one row per assertion, the photographs it
 * was judged on, and the override sheet. 🔒 The original outcome never changes — an
 * override is a second line beside it, kept with who made it and when.
 */
export function RunResultsScreen({ runId }: RunResultsScreenProps) {
  const t = useT();
  const router = useRouter();
  const formatClock = useFormatClock();
  const query = useSpotCheckRun(runId);
  const outlets = useSpotCheckOutlets();
  const setModulesNotice = useModulesNotice((state) => state.setNotice);
  const { data: me } = useMe();
  const pull = usePullToRefresh(() => void query.refetch());
  const [opening, setOpening] = React.useState<SpotCheckResult | null>(null);
  // The platform has said it takes no override after the close: no row opens.
  const noOverride = usePlatformLimit('overrideAfterClose');

  const status = query.error instanceof ApiError ? query.error.status : null;
  const moduleOff = status === 404;
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.spot-checks-off'), { outlet: me?.business.name ?? '' }),
    );
    router.replace('/modules');
  }, [moduleOff, me?.business.name, router, setModulesNotice, t]);

  const run = query.data;
  const time = (iso: string) => formatClock(isoToClock(iso));
  const outlet = outlets.outlets.find((o) => o.id === run?.outlet_id);
  const eyebrow =
    outlets.outlets.length > 1 && outlet
      ? format(t('spot.eyebrow'), { outlet: outlet.name })
      : t('modules.spot-checks');
  const frame = {
    backHref: '/spot-checks/results' as const,
    eyebrow,
    onRefresh: pull.onRefresh,
    refreshing: pull.refreshing,
  };

  if (!run || run.status !== 'FINALIZED' || !run.window_close) {
    return (
      <PushedScreen title={t('spot.results')} {...frame}>
        <SpotCheckLinks />
        {query.isError && !moduleOff ? (
          <RetryBanner
            message={t('common.offline')}
            retryLabel={t('common.retry')}
            onRetry={() => void query.refetch()}
            retrying={query.isRefetching}
          />
        ) : (
          <SkeletonRows count={4} />
        )}
      </PushedScreen>
    );
  }

  const captures = run.captures ?? [];
  const sent = captures.filter((capture) => capture.photo !== null).length;
  const summary = closedSummary({
    completion: run.completion,
    sent,
    total: captures.length,
  });
  const ownOnly = run.results === null;
  const results = [...(run.results ?? [])].sort(
    (a, b) => a.assertion_position - b.assertion_position,
  );

  return (
    <PushedScreen title={subjectName(run)} {...frame}>
      <Text className="font-sans-semibold mx-5 -mt-1 mb-3 text-[15px] leading-snug">
        {run.spot_check_name}
      </Text>

      <SpotCheckLinks />

      {query.isError ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : null}

      <View className="border-border bg-card mx-4 mb-3 rounded-3xl border px-4 py-4">
        <Text className="font-sans-bold text-[20px] leading-tight">
          {format(t('spot.closed-at'), { time: time(run.window_close) })}
        </Text>
        <Text className="mt-1.5 text-[15px] leading-snug">
          {closedLine(summary, t)}
        </Text>
      </View>

      {run.issue_id !== null ? (
        <View className="mx-4 mb-3">
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/50 self-start"
            onPress={() => router.push('/issues')}
          >
            <Flag className="text-destructive-soft-foreground size-4" />
            <Text className="text-destructive-soft-foreground">
              {t('spot.issue-raised')}
            </Text>
          </Button>
        </View>
      ) : null}

      {ownOnly ? (
        <View className="mx-4 mb-3">
          <Banner tone="notice" message={t('spot.own-only')} />
        </View>
      ) : results.length > 0 ? (
        <View className="shadow-card border-border bg-card mx-4 mb-4 overflow-hidden rounded-3xl border">
          {results.map((result, index) => (
            <ResultRow
              key={result.id}
              result={result}
              first={index === 0}
              onOpen={
                result.outcome === 'PENDING_JUDGEMENT' || noOverride
                  ? undefined
                  : () => setOpening(result)
              }
            />
          ))}
        </View>
      ) : null}

      {captures.length > 0 ? (
        <>
          <Text className="text-muted-foreground mx-5 mb-2 text-[13px] leading-snug font-medium">
            {t('spot.photos')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 px-4 pb-1"
          >
            {captures.flatMap((capture) => captureTiles(capture, t, time))}
          </ScrollView>
        </>
      ) : null}

      <OverrideSheet
        key={opening?.id ?? 'none'}
        runId={run.id}
        result={opening}
        onClose={() => setOpening(null)}
      />
    </PushedScreen>
  );
}
