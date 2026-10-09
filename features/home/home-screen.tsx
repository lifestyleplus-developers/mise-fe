import { useMe } from '@/features/auth/use-me';
import { FilterChip } from '@/features/home/filter-chip';
import { useHomeNotice } from '@/features/home/home-notice';
import { clockTime, dayKey } from '@/features/home/run-time';
import { RunRow, type RunRowVariant } from '@/features/home/run-row';
import { RunSection, RunSectionSkeleton } from '@/features/home/run-section';
import { useRuns } from '@/features/home/use-runs';
import { TAB } from '@/features/shell/tabs';
import { TabScreen } from '@/features/shell/tab-screen';
import type { Run } from '@/shared/api/types';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { EmptyState } from '@/shared/components/empty-state';
import { OptionList } from '@/shared/components/option-list';
import { RetryBanner } from '@/shared/components/retry-banner';
import { AutoDismissBanner } from '@/shared/components/auto-dismiss-banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useNow } from '@/shared/lib/use-now';
import { canAdminister } from '@/shared/constants/roles';
import { format, useT } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import {
  CirclePlay,
  ClipboardList,
  Clock,
  Eye,
  SearchX,
  CircleCheck,
} from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

const ALL = '';

type Sheet = 'outlet' | 'checklist' | null;

/** Home — "what needs doing now" (CHK-01, FE Spec §3.2). */
export function HomeScreen() {
  const { data: me } = useMe();
  const t = useT();
  const router = useRouter();
  const now = useNow();
  const runsQuery = useRuns();
  const [outlet, setOutlet] = React.useState<string>();
  const [checklist, setChecklist] = React.useState<string>();
  const [sheet, setSheet] = React.useState<Sheet>(null);
  const notice = useHomeNotice((state) => state.notice);
  const clearNotice = useHomeNotice((state) => state.clearNotice);

  const live = React.useMemo(
    () =>
      (runsQuery.data ?? []).filter(
        (run) => now < new Date(run.window_close).getTime(),
      ),
    [runsQuery.data, now],
  );

  if (!me) return null;

  const hasAssignments =
    me.memberships.cl_imp_assignments.length > 0 ||
    me.memberships.cl_admin_assignments.length > 0;

  const outlets = [...new Set(live.map((run) => run.outlet_name))];
  const checklists = [...new Set(live.map((run) => run.checklist_name))].sort();
  const showOutletChip = outlets.length > 1;
  const showChecklistChip = checklists.length > 1;

  const filtered = live.filter(
    (run) =>
      (!outlet || run.outlet_name === outlet) &&
      (!checklist || run.checklist_name === checklist),
  );

  const opened = (run: Run) => new Date(run.window_open).getTime() <= now;
  const done = (run: Run) => run.answered_count >= run.total_tasks;
  const byUrgency = (a: Run, b: Run) =>
    Number(done(a)) - Number(done(b)) ||
    new Date(a.window_close).getTime() - new Date(b.window_close).getTime();

  const openNow = filtered
    .filter((run) => opened(run) && run.my_role === 'CL_IMP')
    .sort(byUrgency);
  const overseeing = filtered
    .filter((run) => opened(run) && run.my_role === 'CL_ADMIN')
    .sort(byUrgency);
  const upcoming = filtered
    .filter((run) => !opened(run))
    .sort(
      (a, b) =>
        new Date(a.window_open).getTime() - new Date(b.window_open).getTime(),
    );

  function renderRow(run: Run, index: number, variant: RunRowVariant) {
    const key =
      variant === 'upcoming'
        ? dayKey(run.window_open, now, 'home.opens', 'home.opens-tomorrow')
        : dayKey(run.window_close, now, 'home.closes', 'home.closes-tomorrow');
    const at = variant === 'upcoming' ? run.window_open : run.window_close;
    return (
      <RunRow
        key={run.id}
        first={index === 0}
        variant={variant}
        name={run.checklist_name}
        outlet={run.outlet_name}
        time={format(t(key), { time: clockTime(at) })}
        progress={{ value: run.answered_count, total: run.total_tasks }}
        progressLabel={format(t('home.progress'), {
          n: String(run.answered_count),
          total: String(run.total_tasks),
        })}
        isComplete={done(run)}
        completeLabel={t('home.complete')}
        watchLabel={t('home.watch-only')}
        onPress={() =>
          router.push({
            pathname: '/runs/[id]',
            params: {
              id: run.id,
              name: run.checklist_name,
              outlet: run.outlet_name,
            },
          })
        }
      />
    );
  }

  const filtersOn = Boolean(outlet || checklist);
  const nextRun = upcoming[0];

  let body: React.ReactNode;
  if (runsQuery.isPending && !runsQuery.isError) {
    body = (
      <>
        <RunSectionSkeleton rows={3} />
        <RunSectionSkeleton rows={1} />
        <RunSectionSkeleton rows={2} />
      </>
    );
  } else if (!runsQuery.data) {
    // Failed with nothing cached: the banner and Retry are all there is.
    body = null;
  } else if (!hasAssignments) {
    body = canAdminister(me.user.role) ? (
      <EmptyState
        icon={ClipboardList}
        title={t('home.empty.title')}
        action={
          <Button onPress={() => router.navigate(`/${TAB.CHECKLISTS}`)}>
            <Text>{t('home.empty.action')}</Text>
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={ClipboardList}
        title={t('home.member-empty')}
        body={t('home.member-empty-body')}
      />
    );
  } else if (filtersOn && filtered.length === 0) {
    body = (
      <EmptyState
        icon={SearchX}
        title={t('home.no-match')}
        action={
          <Button
            variant="outline"
            onPress={() => {
              setOutlet(undefined);
              setChecklist(undefined);
            }}
          >
            <Text>{t('home.clear-filters')}</Text>
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        {openNow.length === 0 && overseeing.length === 0 ? (
          <View className="mb-4">
            <EmptyState
              icon={CircleCheck}
              title={t('home.nothing-open')}
              body={
                nextRun
                  ? format(
                      t(
                        dayKey(
                          nextRun.window_open,
                          now,
                          'home.next',
                          'home.next-tomorrow',
                        ),
                      ),
                      {
                        name: nextRun.checklist_name,
                        time: clockTime(nextRun.window_open),
                      },
                    )
                  : undefined
              }
            />
          </View>
        ) : null}
        {openNow.length > 0 ? (
          <RunSection icon={CirclePlay} title={t('home.open-now')}>
            {openNow.map((run, i) => renderRow(run, i, 'open'))}
          </RunSection>
        ) : null}
        {overseeing.length > 0 ? (
          <RunSection icon={Eye} title={t('home.overseeing')}>
            {overseeing.map((run, i) => renderRow(run, i, 'overseeing'))}
          </RunSection>
        ) : null}
        {upcoming.length > 0 ? (
          <RunSection icon={Clock} title={t('home.upcoming')} muted>
            {upcoming.map((run, i) => renderRow(run, i, 'upcoming'))}
          </RunSection>
        ) : null}
      </>
    );
  }

  const showChips =
    !runsQuery.isPending && runsQuery.data && hasAssignments
      ? showOutletChip || showChecklistChip
      : false;

  const sheetOptions = sheet === 'outlet' ? outlets : checklists;
  const sheetValue = (sheet === 'outlet' ? outlet : checklist) ?? ALL;

  return (
    <TabScreen title={t('tab.home')} eyebrow={me.business.name}>
      {runsQuery.isError ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void runsQuery.refetch()}
          retrying={runsQuery.isRefetching}
        />
      ) : null}

      {notice ? (
        <View className="mx-4 mb-3">
          <AutoDismissBanner
            tone="notice"
            message={notice}
            onDismiss={clearNotice}
          />
        </View>
      ) : null}

      {showChips ? (
        <View className="mb-3 flex-row flex-wrap gap-2 px-4">
          {showOutletChip ? (
            <FilterChip
              label={t('home.all-outlets')}
              value={outlet}
              clearLabel={t('home.clear-filter')}
              onOpen={() => setSheet('outlet')}
              onClear={() => setOutlet(undefined)}
            />
          ) : null}
          {showChecklistChip ? (
            <FilterChip
              label={t('home.all-checklists')}
              value={checklist}
              clearLabel={t('home.clear-filter')}
              onOpen={() => setSheet('checklist')}
              onClear={() => setChecklist(undefined)}
            />
          ) : null}
        </View>
      ) : null}

      {body}

      <BottomSheet
        visible={sheet !== null}
        title={t(
          sheet === 'outlet' ? 'home.outlet-sheet' : 'home.checklist-sheet',
        )}
        onDismiss={() => setSheet(null)}
        footer={
          <Button variant="outline" onPress={() => setSheet(null)}>
            <Text>{t('admin.cancel')}</Text>
          </Button>
        }
      >
        <OptionList
          value={sheetValue}
          options={[
            {
              value: ALL,
              label: t(
                sheet === 'outlet' ? 'home.all-outlets' : 'home.all-checklists',
              ),
            },
            ...sheetOptions.map((name) => ({ value: name, label: name })),
          ]}
          onChange={(value) => {
            const next = value === ALL ? undefined : value;
            if (sheet === 'outlet') setOutlet(next);
            else setChecklist(next);
            setSheet(null);
          }}
        />
      </BottomSheet>
    </TabScreen>
  );
}
