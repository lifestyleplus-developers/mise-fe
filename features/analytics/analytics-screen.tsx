import { useMe } from '@/features/auth/use-me';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type {
  ChecklistHistoryRow,
  ChecklistOutletsReport,
  Incident,
} from '@/shared/api/types';
import { EmptyState } from '@/shared/components/empty-state';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { formatDay, toDay } from '@/shared/lib/date-range';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  ChevronRight,
  CircleX,
  Hourglass,
  Zap,
  ChartNoAxesColumn,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Skeleton } from '@/shared/components/skeleton';
import { TaskRowsSkeleton } from '@/features/run/task-row';

import {
  useChecklistHistory,
  useChecklistIssues,
  useChecklistOutlets,
} from './use-analytics';
import { ScoreChart } from './score-chart';

/** A score from 0 to 1 as a whole percentage. */
const percent = (score: number) => Math.round(score * 100);

/**
 * Checklist analytics (OVS-02, FE Spec §3.5). "Across outlets" compares the
 * same checklist at every outlet the caller may see, today's scores only;
 * "Over time" is one outlet's periods. There is no business-wide score.
 * A manager with one outlet, or a one-outlet business, lands on Over time.
 */
export function ChecklistAnalyticsScreen() {
  const { id, name, assignment, outlet } = useLocalSearchParams<{
    id: string;
    name?: string;
    assignment?: string;
    outlet?: string;
  }>();
  const checklistId = Number(id);
  const { data: me } = useMe();
  const t = useT();
  const picked = assignment ? Number(assignment) : undefined;
  const outlets = useChecklistOutlets(checklistId, picked === undefined);

  if (!me) return null;

  const report = outlets.data;
  const only = report && report.outlets.length === 1 ? report.outlets[0] : null;
  const assignmentId = picked ?? only?.assignment_id;
  const checklistName = report?.checklist.name ?? name ?? '';

  if (assignmentId !== undefined) {
    const outletName =
      outlet ??
      report?.outlets.find((o) => o.assignment_id === assignmentId)?.outlet
        .name ??
      '';
    return (
      <OverTime
        checklistId={checklistId}
        checklistName={checklistName}
        assignmentId={assignmentId}
        outletName={outletName}
      />
    );
  }

  return (
    <PushedScreen
      title={checklistName || t('checklists.analytics')}
      eyebrow={t('checklists.analytics')}
      backHref="/checklists"
    >
      {outlets.isPending && !outlets.isError ? (
        <TaskRowsSkeleton rows={4} />
      ) : !report ? (
        <LoadFailed
          retrying={outlets.isRefetching}
          onRetry={() => void outlets.refetch()}
        />
      ) : (
        <>
          {outlets.isError ? (
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void outlets.refetch()}
              retrying={outlets.isRefetching}
            />
          ) : null}
          <AcrossOutlets
            report={report}
            checklistName={checklistName}
            checklistId={checklistId}
          />
        </>
      )}
    </PushedScreen>
  );
}

function LoadFailed({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  const t = useT();
  return (
    <View className="mx-4 gap-2">
      <Banner tone="error" message={t('ovs.load-failed')} />
      <Button
        variant="outline"
        className="self-start"
        disabled={retrying}
        onPress={onRetry}
      >
        <Text>{t('iss.try-again')}</Text>
      </Button>
    </View>
  );
}

type OutletRow = {
  assignmentId: number;
  outlet: string;
  /** 0–100, or null while the outlet has no score from today. */
  score: number | null;
  /** The day of the run, only when it is not today. */
  date?: string;
};

function AcrossOutlets({
  report,
  checklistName,
  checklistId,
}: {
  report: ChecklistOutletsReport;
  checklistName: string;
  checklistId: number;
}) {
  const t = useT();
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);
  const today = toDay(new Date());

  // Today only: the latest run, if it closed today and has a score. A run that
  // opened the day before (overnight) says so; anything older is "No score yet".
  const rows: OutletRow[] = report.outlets
    .map((entry) => {
      const run = entry.latest_run;
      const scored =
        run !== null &&
        run.score !== null &&
        toDay(new Date(run.window_close)) === today;
      const opened = run ? toDay(new Date(run.window_open)) : today;
      return {
        assignmentId: entry.assignment_id,
        outlet: entry.outlet.name,
        score: scored ? percent(run.score!) : null,
        date:
          scored && opened !== today ? formatDay(opened, language) : undefined,
      };
    })
    .sort((a, b) =>
      a.score === null
        ? b.score === null
          ? 0
          : 1
        : b.score === null
          ? -1
          : a.score - b.score,
    );

  if (rows.length === 0) {
    return <EmptyState icon={ChartNoAxesColumn} title={t('ovs.empty')} />;
  }

  return (
    <View>
      <Text
        accessibilityRole="header"
        className="font-sans-semibold mx-5 mb-2 text-[14px] leading-snug"
      >
        {format(t('ovs.today'), { date: formatDay(today, language) })}
      </Text>
      <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
        {rows.map((row, index) => {
          const score =
            row.score === null ? t('ovs.no-score') : `${row.score}%`;
          return (
            <Pressable
              key={row.assignmentId}
              accessibilityRole="button"
              accessibilityLabel={format(t('ovs.open-outlet'), {
                outlet: row.outlet,
                score,
              })}
              onPress={() =>
                router.push({
                  pathname: '/checklists/[id]/analytics',
                  params: {
                    id: checklistId,
                    name: checklistName,
                    assignment: row.assignmentId,
                    outlet: row.outlet,
                  },
                })
              }
              className={`active:bg-accent min-h-16 flex-row items-center gap-3 px-4 py-3 ${index > 0 ? 'border-border border-t' : ''}`}
            >
              <View className="min-w-0 flex-1">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="font-sans-medium min-w-0 flex-1 text-[15px] leading-snug">
                    {row.outlet}
                  </Text>
                  <Text
                    className={`font-sans-semibold shrink-0 text-[15px] ${row.score === null ? 'text-muted-foreground' : ''}`}
                  >
                    {score}
                  </Text>
                </View>
                {row.date ? (
                  <Text className="text-muted-foreground text-[13px] leading-snug">
                    {row.date}
                  </Text>
                ) : null}
                {row.score !== null ? (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full"
                  >
                    <View
                      className="bg-foreground/70 h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, row.score))}%`,
                      }}
                    />
                  </View>
                ) : null}
              </View>
              <ChevronRight className="text-muted-foreground size-5 shrink-0" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function OverTime({
  checklistId,
  checklistName,
  assignmentId,
  outletName,
}: {
  checklistId: number;
  checklistName: string;
  assignmentId: number;
  outletName: string;
}) {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const history = useChecklistHistory(checklistId, assignmentId);
  const rows = history.data?.pages.flatMap((page) => page.results) ?? [];
  const issues = useChecklistIssues(checklistId, rows.length > 0);

  // A period closed at the platform's own scoring, so `score` is null only
  // while it is still being judged; those have no point on the line.
  const scored = rows.filter((row) => row.score !== null);
  const oldestFirst = [...scored].reverse();
  const day = (row: ChecklistHistoryRow) =>
    formatDay(toDay(new Date(row.window_open)), language);
  const failedWithNothing = history.isError && !history.data;
  const notFound =
    history.error instanceof ApiError && history.error.status === 404;

  return (
    <PushedScreen
      title={outletName || checklistName}
      eyebrow={checklistName}
      backHref="/checklists"
    >
      {history.isPending && !history.isError ? (
        <View className="gap-3">
          <Skeleton className="bg-muted mx-4 h-36 rounded-3xl" />
          <TaskRowsSkeleton rows={4} />
        </View>
      ) : failedWithNothing ? (
        notFound ? (
          <View className="mx-4">
            <Banner tone="notice" message={t('iss.gone')} />
          </View>
        ) : (
          <LoadFailed
            retrying={history.isRefetching}
            onRetry={() => void history.refetch()}
          />
        )
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ChartNoAxesColumn}
          title={format(t('ovs.empty-at'), { outlet: outletName })}
        />
      ) : (
        <>
          {history.isError ? (
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void history.refetch()}
              retrying={history.isRefetching}
            />
          ) : null}
          {oldestFirst.length > 0 ? (
            <ScoreChart
              points={oldestFirst.map((row) => percent(row.score!))}
              firstLabel={day(oldestFirst[0])}
              lastLabel={day(oldestFirst[oldestFirst.length - 1])}
              label={format(t('ovs.chart'), {
                values: oldestFirst
                  .map((row) => `${day(row)} ${percent(row.score!)}%`)
                  .join(', '),
              })}
            />
          ) : null}
          <Text
            accessibilityRole="header"
            className="font-sans-semibold mx-5 mt-4 mb-2 text-[15px]"
          >
            {t('ovs.periods')}
          </Text>
          <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
            {rows.map((row, index) => (
              <PeriodRow
                key={row.run_id}
                row={row}
                first={index === 0}
                date={day(row)}
                incident={issues.data?.get(row.run_id)}
              />
            ))}
          </View>
          {history.hasNextPage ? (
            <Pressable
              accessibilityRole="button"
              disabled={history.isFetchingNextPage}
              onPress={() => void history.fetchNextPage()}
              className="active:bg-accent mx-4 mt-2 min-h-11 justify-center rounded-full px-2"
            >
              <Text className="font-sans-semibold text-[15px] underline underline-offset-2">
                {t('ovs.load-earlier')}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </PushedScreen>
  );
}

function PeriodRow({
  row,
  first,
  date,
  incident,
}: {
  row: ChecklistHistoryRow;
  first: boolean;
  date: string;
  incident?: Incident;
}) {
  const t = useT();
  const router = useRouter();
  const resolved = incident?.status === 'RESOLVED';

  const marks = (
    <View className="mt-0.5 flex-row flex-wrap items-center gap-x-3 gap-y-1">
      {incident ? (
        resolved ? (
          <View className="flex-row items-center gap-1">
            <Check className="text-muted-foreground size-4" strokeWidth={2.5} />
            <Text className="text-muted-foreground text-[13px]">
              {t('ovs.resolved')}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1">
            <CircleX className="text-foreground size-4" />
            <Text className="font-sans-semibold text-[13px]">
              {t('ovs.issue')}
            </Text>
          </View>
        )
      ) : null}
      {row.rushed ? (
        <View className="flex-row items-center gap-1">
          <Zap className="text-foreground size-4" />
          <Text className="text-[13px]">{t('iss.rushed')}</Text>
        </View>
      ) : null}
      {row.assessing_count ? (
        <View className="flex-row items-center gap-1">
          <Hourglass className="text-foreground size-4" />
          <Text className="text-[13px]">
            {format(t('iss.n-assessing'), { n: String(row.assessing_count) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
  const score =
    row.score === null ? t('ovs.no-score') : `${percent(row.score)}%`;
  const content = (
    <>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="text-[15px] leading-snug">{date}</Text>
          <Text className="font-sans-semibold text-[15px]">{score}</Text>
        </View>
        {marks}
      </View>
      {incident ? (
        <ChevronRight className="text-muted-foreground mt-0.5 size-5 shrink-0" />
      ) : (
        <View className="size-5 shrink-0" />
      )}
    </>
  );
  const frame = `min-h-14 flex-row items-start gap-3 px-4 py-3 ${first ? '' : 'border-border border-t'}`;

  return incident ? (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/issues/[id]',
          params: { id: incident.id },
        })
      }
      className={`${frame} active:bg-accent`}
    >
      {content}
    </Pressable>
  ) : (
    <View className={frame}>{content}</View>
  );
}
