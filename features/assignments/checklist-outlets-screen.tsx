import { OutletRow } from '@/features/assignments/outlet-row';
import {
  applyLabel,
  runningAfter,
  splitStaged,
  toggleStage,
  type Staged,
} from '@/features/assignments/outlet-staging';
import {
  useAssignOutlets,
  useAssignments,
  useStopAssignment,
} from '@/features/assignments/use-assignments';
import { TeamPicker } from '@/features/assignments/team-picker';
import { useTeams } from '@/features/assignments/use-members';
import { classifyEditorError } from '@/features/checklist-editor/checklist-errors';
import { useChecklist } from '@/features/checklist-editor/use-checklist';
import { useOutlets } from '@/features/outlets/use-outlets';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DiscardChangesDialog } from '@/shared/components/discard-changes-dialog';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { THEME } from '@/shared/lib/theme';
import { useUnsavedChanges } from '@/shared/lib/use-unsaved-changes';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Info, Store } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

type Message = { tone: 'error' | 'notice'; text: string } | null;

/** CHK-07: tick the outlets a checklist runs at, then Apply. */
export function ChecklistOutletsScreen() {
  const t = useT();
  const theme = useAppliedTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const checklistId = Number(params.id);

  const checklist = useChecklist(checklistId);
  const assignments = useAssignments(checklistId);
  const outlets = useOutlets();
  const assign = useAssignOutlets(checklistId);
  const stop = useStopAssignment(checklistId);
  const rows = assignments.data ?? [];
  const teams = useTeams(rows.map((row) => row.id));

  const [staged, setStaged] = React.useState<Staged>({});
  const [failedOutlets, setFailedOutlets] = React.useState<number[]>([]);
  const [applying, setApplying] = React.useState(false);
  const [confirmStop, setConfirmStop] = React.useState(false);
  const [banner, setBanner] = React.useState<Message>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [picking, setPicking] = React.useState<number | null>(null);
  /** Outlet → the people who came back when it was started again, as the platform said. */
  const [fromBefore, setFromBefore] = React.useState<Record<number, number[]>>(
    {},
  );

  const guard = useUnsavedChanges({
    initial: {} as Staged,
    current: staged,
    saving: applying,
  });

  const name = checklist.data?.name ?? '';
  const taskCount = checklist.data?.tasks.length ?? 0;
  const noTasks = checklist.data !== undefined && taskCount === 0;

  const queryFailure = [checklist, assignments, outlets].find((q) => q.isError);
  const loadFailure =
    queryFailure && !queryFailure.data
      ? classifyEditorError(queryFailure.error)
      : null;
  const locked = forbidden || loadFailure === 'forbidden';
  const loading =
    !loadFailure &&
    (checklist.isPending || assignments.isPending || outlets.isPending);

  const rowOf = (outletId: number) =>
    rows.find((row) => row.outlet.id === outletId);
  /** Archived outlets drop out of the list unless they still carry the checklist. */
  const shown = (outlets.data ?? []).filter(
    (outlet) => !outlet.is_archived || rowOf(outlet.id) !== undefined,
  );
  const managersOf = (outletId: number): string[] => {
    const row = rowOf(outletId);
    return (row ? (teams.byAssignment[row.id] ?? []) : [])
      .filter((member) => member.role === 'CL_ADMIN')
      .map((member) => member.full_name);
  };
  const isRunning = (outletId: number) => rowOf(outletId)?.is_active === true;

  const { starts, stops } = splitStaged(staged);
  const label = applyLabel(starts.length, stops.length);
  const canApply =
    starts.length + stops.length > 0 && !noTasks && !applying && !locked;
  const nobodyRunning = !shown.some(
    (outlet) => isRunning(outlet.id) && !outlet.is_archived,
  );

  function statusOf(outletId: number, archived: boolean): string {
    const stage = staged[outletId];
    if (stage && failedOutlets.includes(outletId)) return t('out.not-applied');
    if (stage === 'start') return t('out.will-start');
    if (stage === 'stop') return t('out.will-stop');
    const running = isRunning(outletId);
    if (archived) {
      return running ? t('out.archived-outlet') : t('out.stopped-archived');
    }
    if (running) {
      const who = managersOf(outletId);
      const base = format(t('out.running'), {
        who: who.length > 0 ? who.join(', ') : t('out.no-manager'),
      });
      return (fromBefore[outletId]?.length ?? 0) > 0
        ? `${base} · ${t('out.from-before')}`
        : base;
    }
    return rowOf(outletId) ? t('out.stopped') : t('out.not-running');
  }

  function toggle(outletId: number) {
    setBanner(null);
    setFailedOutlets((current) => current.filter((id) => id !== outletId));
    setStaged((current) => toggleStage(current, outletId, isRunning(outletId)));
  }

  async function apply() {
    setConfirmStop(false);
    setApplying(true);
    setBanner(null);

    const startResult = starts.length
      ? await assign.mutateAsync(starts).then(
          (assignments) => ({ ok: true as const, assignments }),
          (error: unknown) => ({ ok: false as const, error }),
        )
      : null;
    const stopResults = await Promise.all(
      stops.map((outletId) => {
        const row = rowOf(outletId);
        return (
          row
            ? stop.mutateAsync(row.id)
            : Promise.reject(new Error('no assignment'))
        ).then(
          () => ({ outletId, ok: true as const }),
          (error: unknown) => ({ outletId, ok: false as const, error }),
        );
      }),
    );

    const failedStops = stopResults.filter((result) => !result.ok);
    const failed = [
      ...(startResult && !startResult.ok ? starts : []),
      ...failedStops.map((result) => result.outletId),
    ];
    const errors = [
      ...(startResult && !startResult.ok ? [startResult.error] : []),
      ...failedStops.map((result) => (result.ok ? null : result.error)),
    ];
    const startsDone = startResult?.ok ? starts : [];
    const stopsDone = stopResults
      .filter((result) => result.ok)
      .map((result) => result.outletId);

    // What went through is no longer waiting; what did not stays ticked.
    setStaged((current) => {
      const next = { ...current };
      for (const id of [...startsDone, ...stopsDone]) delete next[id];
      return next;
    });
    setFailedOutlets(failed);
    if (startResult?.ok) {
      const returning = startResult.assignments.filter(
        (assignment) => (assignment.returning_members?.length ?? 0) > 0,
      );
      setFromBefore((current) => ({
        ...current,
        ...Object.fromEntries(
          returning.map((assignment) => [
            assignment.outlet.id,
            (assignment.returning_members ?? []).map((m) => m.user_id),
          ]),
        ),
      }));
    }

    if (errors.some((error) => classifyEditorError(error) === 'forbidden')) {
      setForbidden(true);
    }

    const total = starts.length + stops.length;
    if (failed.length === total) {
      setBanner({ tone: 'error', text: t('out.save-failed') });
    } else if (failed.length > 0) {
      setBanner({
        tone: 'error',
        text: format(t('out.part-failed'), { n: String(failed.length) }),
      });
    } else {
      const runningNow = shown.filter(
        (outlet) => isRunning(outlet.id) && !outlet.is_archived,
      ).length;
      const count = runningAfter(
        runningNow,
        startsDone.length,
        stopsDone.length,
      );
      setBanner({
        tone: 'notice',
        text:
          count === 0
            ? `${name}: ${t('sched.nowhere')}`
            : format(t(count === 1 ? 'out.applied-one' : 'out.applied-n'), {
                name,
                n: String(count),
              }),
      });
    }
    setApplying(false);
  }

  const stopTitle =
    stops.length === 1
      ? format(t('out.stop-title'), {
          name,
          outlet: shown.find((o) => o.id === stops[0])?.name ?? '',
        })
      : format(t('out.stop-title-many'), { name, n: String(stops.length) });

  const pickedOutlet = shown.find((o) => o.id === picking);
  const pickedRow = picking !== null ? rowOf(picking) : undefined;

  return (
    <PushedScreen
      title={name}
      eyebrow={t('editor.outlets-title')}
      adminOnly
      backHref="/checklists/admin"
      footer={
        locked || loadFailure ? undefined : (
          <Button
            className="w-full"
            disabled={!canApply}
            onPress={() =>
              stops.length > 0 ? setConfirmStop(true) : void apply()
            }
          >
            {applying ? (
              <ActivityIndicator
                size="small"
                color={THEME[theme].primaryForeground}
              />
            ) : null}
            <Text>{format(t(label.key), { n: String(label.n ?? '') })}</Text>
          </Button>
        )
      }
    >
      <View className="gap-3 pb-3">
        {locked ? <Notice tone="error" text={t('out.forbidden')} /> : null}
        {loadFailure === 'gone' ? (
          <Notice tone="error" text={t('sched.gone')} />
        ) : null}
        {loadFailure === 'failed' ? (
          <RetryBanner
            message={t('common.offline')}
            retryLabel={t('common.retry')}
            onRetry={() => {
              void checklist.refetch();
              void assignments.refetch();
              void outlets.refetch();
            }}
          />
        ) : null}
        {banner && !locked ? (
          <Notice tone={banner.tone} text={banner.text} />
        ) : null}
        {noTasks ? (
          <View className="mx-4 gap-2">
            <Banner tone="notice" message={t('out.no-tasks')} icon={Info} />
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onPress={() =>
                router.push({
                  pathname: '/checklists/[id]/tasks',
                  params: { id: checklistId },
                })
              }
            >
              <Text>{t('out.go-tasks')}</Text>
            </Button>
          </View>
        ) : null}
        {nobodyRunning && !noTasks && !loading && !loadFailure ? (
          <Text className="mx-4 px-1 text-[14px] leading-snug">
            {t('out.hint')}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <SkeletonRows count={4} />
      ) : loadFailure ? null : (
        <>
          <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
            {shown.map((outlet, index) => {
              const stage = staged[outlet.id];
              const running = isRunning(outlet.id);
              const row = rowOf(outlet.id);
              const hasManager = managersOf(outlet.id).length > 0;
              const showAction =
                running && !outlet.is_archived && stage !== 'stop' && row;
              return (
                <OutletRow
                  key={outlet.id}
                  first={index === 0}
                  name={outlet.name}
                  status={statusOf(outlet.id, outlet.is_archived)}
                  checked={stage === 'start' || (running && stage !== 'stop')}
                  disabled={outlet.is_archived || locked || applying}
                  working={applying && stage !== undefined}
                  onToggle={() => toggle(outlet.id)}
                  action={
                    showAction
                      ? {
                          label: t(
                            hasManager ? 'out.team' : 'out.name-manager',
                          ),
                          ariaLabel: `${t(
                            hasManager ? 'out.team' : 'out.name-manager',
                          )}: ${outlet.name}`,
                          onPress: () =>
                            hasManager
                              ? router.push({
                                  pathname: '/assignments/[id]/members',
                                  params: {
                                    id: row.id,
                                    checklist: name,
                                    outlet: outlet.name,
                                    // Option A: the note lives for this visit only.
                                    ...(fromBefore[outlet.id]
                                      ? {
                                          returning:
                                            fromBefore[outlet.id].join(','),
                                        }
                                      : {}),
                                  },
                                })
                              : setPicking(outlet.id),
                        }
                      : undefined
                  }
                />
              );
            })}
          </View>
          <Text className="mx-4 mt-3 px-1 text-[13px] leading-snug">
            {t('out.runs-start')}
          </Text>
        </>
      )}

      {pickedOutlet && pickedRow ? (
        <TeamPicker
          assignmentId={pickedRow.id}
          role="CL_ADMIN"
          title={format(t('out.pick-manager'), { outlet: pickedOutlet.name })}
          viewerIsAdmin
          onClose={() => setPicking(null)}
        />
      ) : null}
      <ConfirmDialog
        visible={confirmStop}
        icon={Store}
        title={stopTitle}
        body={t('out.stop-body')}
        safe={{
          label: t('admin.cancel'),
          onPress: () => setConfirmStop(false),
        }}
        other={{ label: t('out.stop'), onPress: () => void apply() }}
      />
      <DiscardChangesDialog
        visible={guard.discardOpen}
        onKeepEditing={guard.keepEditing}
        onDiscard={guard.discard}
      />
    </PushedScreen>
  );
}

function Notice({ tone, text }: { tone: 'error' | 'notice'; text: string }) {
  return (
    <View className="mx-4" accessibilityLiveRegion="polite">
      <Banner tone={tone} message={text} />
    </View>
  );
}
