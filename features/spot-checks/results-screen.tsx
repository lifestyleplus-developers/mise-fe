import { PushedScreen } from '@/features/shell/pushed-screen';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { useMe } from '@/features/auth/use-me';
import { ApiError } from '@/shared/api/client';
import type { SpotCheckOutcome, SpotCheckRun } from '@/shared/api/types';
import { EmptyState } from '@/shared/components/empty-state';
import { FilterChips } from '@/shared/components/filter-chips';
import {
  OutletPicker,
  useSelectedOutlet,
} from '@/shared/components/outlet-picker';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton, SkeletonRows } from '@/shared/components/skeleton';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useRouter } from 'expo-router';
import { ListChecks } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { closedSummary, sentCount } from './capture-view';
import { closedLine } from './closed-line';
import { spotCheckResultsHref } from './links';
import { SpotCheckLinks } from './spot-check-links';
import { subjectName, tallyResults } from './spot-outcome';
import { useSpotCheckOutlets } from './use-spot-check-outlets';
import { useSpotCheckRuns } from './use-spot-check-runs';

type FilterValue = 'ALL' | SpotCheckOutcome;

/**
 * Results (SPT-03, the list): every closed run, grouped under itself with its tally.
 * Runs still waiting on a review sort first, then newest. Filter by outcome.
 */
export function ResultsScreen() {
  const t = useT();
  const router = useRouter();
  const formatClock = useFormatClock();
  const { data: me } = useMe();
  const setModulesNotice = useModulesNotice((state) => state.setNotice);
  const outlets = useSpotCheckOutlets();
  const [outlet, setOutletId] = useSelectedOutlet(outlets.outlets);
  const [filter, setFilter] = React.useState<FilterValue>('ALL');

  const query = useSpotCheckRuns(
    {
      state: 'closed',
      outletId: outlet?.id,
      outcome: filter === 'ALL' ? undefined : filter,
    },
    outlet !== undefined,
  );
  const pull = usePullToRefresh(() => {
    void query.refetch();
    outlets.refetch();
  });

  const status = query.error instanceof ApiError ? query.error.status : null;
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

  const runs = query.data?.pages.flatMap((page) => page.results) ?? [];
  const loading =
    outlets.isPending || (query.isPending && outlet !== undefined);
  const failed = query.isError || outlets.isError;
  const multiOutlet = outlets.outlets.length > 1;

  function loadMore() {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }

  const options: { value: FilterValue; label: string }[] = [
    { value: 'ALL', label: t('spot.filter-all') },
    { value: 'PASS', label: t('spot.passed') },
    { value: 'FAIL', label: t('spot.failed') },
    { value: 'NEEDS_REVIEW', label: t('spot.review') },
  ];

  function row(run: SpotCheckRun, index: number) {
    const ownOnly = run.results === null;
    const tally = ownOnly ? null : tallyResults(run.results ?? []);
    return (
      <Pressable
        key={run.id}
        accessibilityRole="button"
        onPress={() => router.push(spotCheckResultsHref(run.id))}
        className={`min-h-16 gap-0.5 px-4 py-3 active:bg-accent ${
          index > 0 ? 'border-border border-t' : ''
        }`}
      >
        <Text className="font-sans-semibold text-[16px] leading-snug">
          {run.spot_check_name}
        </Text>
        <Text className="text-muted-foreground text-[13px] leading-snug">
          {subjectName(run)}
          {run.window_close
            ? ` · ${format(t('spot.closed-at'), { time: formatClock(isoToClock(run.window_close)) })}`
            : ''}
        </Text>
        <Text className="mt-0.5 text-[13px] leading-snug">
          {ownOnly
            ? t('spot.own-only')
            : run.completion === 'NOT_DONE'
              ? closedLine(
                  closedSummary({
                    completion: run.completion,
                    sent: sentCount(run.captures ?? []),
                    total: run.captures?.length ?? 0,
                  }),
                  t,
                )
              : tally!.pending > 0
                ? t('spot.assessing')
                : format(t('spot.tally'), {
                    passed: String(tally!.passed),
                    failed: String(tally!.failed),
                    review: String(tally!.review),
                  })}
        </Text>
      </Pressable>
    );
  }

  let body: React.ReactNode;
  if (loading) {
    body = failed ? null : <SkeletonRows count={3} />;
  } else if (query.isError && runs.length === 0) {
    body = null; // The Retry banner above says so.
  } else if (runs.length === 0 && filter !== 'ALL') {
    body = (
      <EmptyState
        icon={ListChecks}
        title={t('spot.filter-empty')}
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() => setFilter('ALL')}
            className="min-h-11 items-center justify-center px-1"
          >
            <Text className="font-sans-semibold text-[14px] underline">
              {t('spot.clear-filter')}
            </Text>
          </Pressable>
        }
      />
    );
  } else if (runs.length === 0) {
    body = <EmptyState icon={ListChecks} title={t('spot.results-empty')} />;
  } else {
    body = (
      <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
        {runs.map((run, index) => row(run, index))}
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
      title={t('spot.results')}
      eyebrow={
        multiOutlet && outlet
          ? format(t('spot.eyebrow'), { outlet: outlet.name })
          : t('modules.spot-checks')
      }
      backHref="/spot-checks"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
      onEndReached={loadMore}
    >
      <SpotCheckLinks />

      {multiOutlet && outlet ? (
        <View className="mx-4 mb-3">
          <OutletPicker
            outlets={outlets.outlets}
            value={outlet.id}
            onChange={(id) => {
              setOutletId(id);
              setFilter('ALL');
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
      {failed && runs.length > 0 ? (
        <Text className="mx-5 mb-3 text-[13px] leading-snug">
          {t('spot.cached')}
        </Text>
      ) : null}

      <View className="mx-4 mb-3">
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={options}
          label={t('spot.filter-all')}
        />
      </View>

      {body}
    </PushedScreen>
  );
}
