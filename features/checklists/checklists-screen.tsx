import { useMe } from '@/features/auth/use-me';
import {
  ChecklistCard,
  ChecklistCardSkeleton,
} from '@/features/checklists/checklist-card';
import { useChecklists } from '@/features/checklists/use-checklists';
import { FilterChip } from '@/features/home/filter-chip';
import { useRuns } from '@/features/home/use-runs';
import { useOutlets } from '@/features/outlets/use-outlets';
import { TabScreen } from '@/features/shell/tab-screen';
import type {
  ChecklistAssignment,
  ChecklistListItem,
  Run,
} from '@/shared/api/types';
import { AutoDismissBanner } from '@/shared/components/auto-dismiss-banner';
import { EmptyState } from '@/shared/components/empty-state';
import { OptionList } from '@/shared/components/option-list';
import { RetryBanner } from '@/shared/components/retry-banner';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { useNow } from '@/shared/lib/use-now';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import { ClipboardList, SearchX } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

const ALL = '';
const MAX_OUTLET_LINES = 3;

const SCHEDULE_KEY = {
  HOURLY: 'checklists.hourly',
  DAILY: 'checklists.daily',
  WEEKLY: 'checklists.weekly',
  MONTHLY: 'checklists.monthly',
} as const satisfies Record<ChecklistListItem['recurrence'], MessageKey>;

/** What the caller is to this checklist, which decides what its card shows. */
type Part = 'all' | 'manager' | 'member';

type Row = {
  checklist: ChecklistListItem;
  part: Part;
  /** The assignments this caller may see; the card lists these outlets. */
  shown: ChecklistAssignment[];
  /** Assignments the caller supervises; non-empty earns the Team button. */
  managed: ChecklistAssignment[];
  unassigned: boolean;
};

function toRow(checklist: ChecklistListItem, isAdmin: boolean): Row | null {
  const { assignments } = checklist;
  const managed = assignments.filter((a) => a.my_role === 'CL_ADMIN');
  const member = assignments.filter((a) => a.my_role === 'CL_IMP');
  const part: Part | null = isAdmin
    ? 'all'
    : managed.length > 0
      ? 'manager'
      : member.length > 0
        ? 'member'
        : null;
  if (!part) return null;
  return {
    checklist,
    part,
    shown: part === 'all' ? assignments : part === 'manager' ? managed : member,
    managed,
    unassigned: assignments.length === 0,
  };
}

/** Checklists — browse the ones you are involved in (CHK-05, FE Spec §3.4). */
export function ChecklistsScreen() {
  const { data: me } = useMe();
  const t = useT();
  const query = useChecklists();
  const outletsQuery = useOutlets();
  const [outlet, setOutlet] = React.useState<string>();
  const [filterSheet, setFilterSheet] = React.useState(false);
  const [teamFor, setTeamFor] = React.useState<{
    id: number;
    name: string;
  } | null>(null);
  const [removedFrom, setRemovedFrom] = React.useState<string | null>(null);
  const [runFor, setRunFor] = React.useState<number | null>(null);
  const router = useRouter();
  const runsQuery = useRuns();
  const now = useNow();

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // The outlet filter runs on the client, so a filtered view needs every page.
  React.useEffect(() => {
    if (outlet && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [outlet, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isAdmin = me ? canAdminister(me.user.role) : false;

  const rows = React.useMemo(() => {
    const out: Row[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const checklist of page.results) {
        if (checklist.is_archived) continue;
        const row = toRow(checklist, isAdmin);
        if (row) out.push(row);
      }
    }
    return out.sort(
      (a, b) =>
        a.checklist.st_time.localeCompare(b.checklist.st_time) ||
        a.checklist.name.localeCompare(b.checklist.name),
    );
  }, [query.data, isAdmin]);

  const openSheetFor = teamFor;
  React.useEffect(() => {
    if (!openSheetFor || !query.data) return;
    const stillManaged = rows.some(
      (r) => r.checklist.id === openSheetFor.id && r.managed.length > 0,
    );
    if (!stillManaged) {
      setTeamFor(null);
      setRemovedFrom(openSheetFor.name);
    }
  }, [openSheetFor, rows, query.data]);

  if (!me) return null;

  const businessOutlets = (outletsQuery.data ?? [])
    .filter((o) => !o.is_archived)
    .map((o) => o.name);
  const seenOutlets = [
    ...new Set(rows.flatMap((r) => r.shown.map((a) => a.outlet_name))),
  ];
  // An admin can filter to any outlet, even one with nothing on it yet.
  const choices =
    isAdmin && businessOutlets.length > 0 ? businessOutlets : seenOutlets;
  const showChip =
    (isAdmin ? businessOutlets.length : seenOutlets.length) > 1 &&
    choices.length > 1;

  const visible = outlet
    ? rows.filter((r) => r.shown.some((a) => a.outlet_name === outlet))
    : rows;

  function describe(row: Row) {
    const { checklist } = row;
    const schedule = format(t(SCHEDULE_KEY[checklist.recurrence]), {
      time: checklist.st_time,
      day: String(checklist.day_of_month ?? ''),
      days: (checklist.weekdays ?? [])
        .map((d) => t(`wd.${d}` as MessageKey))
        .join(', '),
    });
    const shown = (
      outlet ? row.shown.filter((a) => a.outlet_name === outlet) : row.shown
    ).slice();

    if (row.part === 'member') {
      return { schedule, lines: shown.map((a) => a.outlet_name) };
    }
    // Weakest first, so the outlet that needs attention leads.
    shown.sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
    return {
      schedule,
      lines: shown.slice(0, MAX_OUTLET_LINES).map((a) =>
        a.score === null
          ? format(t('checklists.no-score'), { outlet: a.outlet_name })
          : format(t('checklists.score'), {
              outlet: a.outlet_name,
              score: String(a.score),
            }),
      ),
      more:
        shown.length > MAX_OUTLET_LINES
          ? format(t('checklists.more'), {
              n: String(shown.length - MAX_OUTLET_LINES),
            })
          : undefined,
    };
  }

  /** Runs of this checklist that are open for the caller right now. */
  function openRunsOf(row: Row) {
    const outlets = new Set(row.shown.map((a) => a.outlet_name));
    return (runsQuery.data ?? []).filter(
      (run) =>
        run.checklist_name === row.checklist.name &&
        outlets.has(run.outlet_name) &&
        (!outlet || run.outlet_name === outlet) &&
        new Date(run.window_open).getTime() <= now &&
        now < new Date(run.window_close).getTime(),
    );
  }

  function openRun(run: Run) {
    router.push({
      pathname: '/runs/[id]',
      params: {
        id: run.id,
        name: run.checklist_name,
        outlet: run.outlet_name,
      },
    });
  }

  function openAnalytics(row: Row) {
    router.push({
      pathname: '/checklists/[id]/analytics',
      params: { id: row.checklist.id, name: row.checklist.name },
    });
  }

  /**
   * A card leads into the work: the checklist's open run if there is one, a
   * choice of outlet if there are several, otherwise its analytics.
   */
  function onCard(row: Row) {
    const runs = openRunsOf(row);
    if (runs.length === 1) openRun(runs[0]);
    else if (runs.length > 1) setRunFor(row.checklist.id);
    else openAnalytics(row);
  }

  function openTeam(row: Row, outletName: string) {
    const assignment = row.managed.find((a) => a.outlet_name === outletName);
    // Taken off the checklist since the card was drawn: say so, don't navigate.
    if (!assignment) {
      setRemovedFrom(row.checklist.name);
      return;
    }
    router.push({
      pathname: '/assignments/[id]/members',
      params: {
        id: assignment.id,
        checklist: row.checklist.name,
        outlet: outletName,
      },
    });
  }

  function onTeam(row: Row) {
    if (row.managed.length === 0) {
      setRemovedFrom(row.checklist.name);
    } else if (row.managed.length === 1) {
      openTeam(row, row.managed[0].outlet_name);
    } else {
      setTeamFor({ id: row.checklist.id, name: row.checklist.name });
    }
  }

  let body: React.ReactNode;
  if (query.isPending && !query.isError) {
    body = <ChecklistCardSkeleton count={4} />;
  } else if (!query.data) {
    // Failed with nothing cached: the banner and Retry are all there is.
    body = null;
  } else if (rows.length === 0) {
    body = isAdmin ? (
      <EmptyState
        icon={ClipboardList}
        title={t('checklists.empty-business')}
        action={
          <Button onPress={() => router.push('/checklists/new')}>
            <Text>{t('checklists.empty-business-action')}</Text>
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
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={SearchX}
        title={t('home.no-match')}
        action={
          <Button variant="outline" onPress={() => setOutlet(undefined)}>
            <Text>{t('home.clear-filters')}</Text>
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        {visible.map((row) => {
          const { schedule, lines, more } = describe(row);
          const { name } = row.checklist;
          return (
            <ChecklistCard
              key={row.checklist.id}
              name={name}
              schedule={schedule}
              outlets={lines}
              more={more}
              note={row.unassigned ? t('checklists.not-assigned') : undefined}
              onOpen={
                // An implementer has no analytics: their card opens only when there is a run to do.
                row.part === 'member' && openRunsOf(row).length === 0
                  ? undefined
                  : () => onCard(row)
              }
              openLabel={format(
                t(
                  openRunsOf(row).length > 0
                    ? 'checklists.open-run'
                    : 'checklists.open-analytics',
                ),
                { name },
              )}
              team={
                row.managed.length > 0
                  ? {
                      label: t('checklists.team'),
                      ariaLabel: `${t('checklists.team')}: ${name}`,
                      onPress: () => onTeam(row),
                    }
                  : undefined
              }
            />
          );
        })}
        {isFetchingNextPage ? <ChecklistCardSkeleton count={1} /> : null}
      </>
    );
  }

  const runRow =
    runFor === null
      ? null
      : (rows.find((r) => r.checklist.id === runFor) ?? null);

  const teamRow =
    teamFor === null
      ? null
      : (rows.find((r) => r.checklist.id === teamFor.id) ?? null);

  return (
    <TabScreen
      title={t('tab.checklists')}
      eyebrow={me.business.name}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
    >
      {query.isError ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : null}

      {removedFrom ? (
        <View className="mx-4 mb-3">
          <AutoDismissBanner
            tone="notice"
            message={format(t('checklists.removed'), { name: removedFrom })}
            onDismiss={() => setRemovedFrom(null)}
          />
        </View>
      ) : null}

      {query.data && rows.length > 0 && showChip ? (
        <View className="mb-3 flex-row flex-wrap gap-2 px-4">
          <FilterChip
            label={t('home.all-outlets')}
            value={outlet}
            clearLabel={t('home.clear-filter')}
            onOpen={() => setFilterSheet(true)}
            onClear={() => setOutlet(undefined)}
          />
        </View>
      ) : null}

      {body}

      <BottomSheet
        visible={filterSheet}
        title={t('home.outlet-sheet')}
        onDismiss={() => setFilterSheet(false)}
        footer={
          <Button variant="outline" onPress={() => setFilterSheet(false)}>
            <Text>{t('admin.cancel')}</Text>
          </Button>
        }
      >
        <OptionList
          value={outlet ?? ALL}
          options={[
            { value: ALL, label: t('home.all-outlets') },
            ...choices.map((name) => ({ value: name, label: name })),
          ]}
          onChange={(value) => {
            setOutlet(value === ALL ? undefined : value);
            setFilterSheet(false);
          }}
        />
      </BottomSheet>

      <BottomSheet
        visible={teamRow != null}
        title={format(t('checklists.team-sheet'), {
          name: teamRow?.checklist.name ?? '',
        })}
        onDismiss={() => setTeamFor(null)}
        footer={
          <Button variant="outline" onPress={() => setTeamFor(null)}>
            <Text>{t('admin.cancel')}</Text>
          </Button>
        }
      >
        <OptionList
          value=""
          options={(teamRow?.managed ?? []).map((a) => ({
            value: a.outlet_name,
            label: a.outlet_name,
          }))}
          onChange={(value) => {
            if (teamRow) openTeam(teamRow, value);
            setTeamFor(null);
          }}
        />
      </BottomSheet>

      <BottomSheet
        visible={runRow != null}
        title={format(t('checklists.run-sheet'), {
          name: runRow?.checklist.name ?? '',
        })}
        onDismiss={() => setRunFor(null)}
        footer={
          <Button variant="outline" onPress={() => setRunFor(null)}>
            <Text>{t('admin.cancel')}</Text>
          </Button>
        }
      >
        <OptionList
          value=""
          options={(runRow ? openRunsOf(runRow) : []).map((run) => ({
            value: String(run.id),
            label: run.outlet_name,
          }))}
          onChange={(value) => {
            const run = runRow
              ? openRunsOf(runRow).find((r) => String(r.id) === value)
              : undefined;
            setRunFor(null);
            if (run) openRun(run);
          }}
        />
      </BottomSheet>
    </TabScreen>
  );
}
