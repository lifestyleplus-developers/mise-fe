import { useMembers } from '@/features/assignments/use-members';
import { useAssignments } from '@/features/assignments/use-assignments';
import {
  classifyEditorError,
  type EditorFailure,
} from '@/features/checklist-editor/checklist-errors';
import {
  ScheduleFields,
  ScheduleSummary,
} from '@/features/checklist-editor/schedule-fields';
import {
  EMPTY_FORM,
  checkForm,
  formFromChecklist,
  hasProblems,
  normalizeForm,
  toRequest,
  type ScheduleForm,
} from '@/features/checklist-editor/schedule-form';
import {
  SummaryRows,
  type SummaryRow,
} from '@/features/checklist-editor/summary-rows';
import {
  useArchiveChecklist,
  useChecklist,
  useCreateChecklist,
  useRestoreChecklist,
  useUpdateChecklist,
} from '@/features/checklist-editor/use-checklist';
import { useChecklistNotice } from '@/features/checklists/checklist-notice';
import { useOutlets } from '@/features/outlets/use-outlets';
import { PushedScreen } from '@/features/shell/pushed-screen';
import type { ChecklistDetail } from '@/shared/api/types';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DiscardChangesDialog } from '@/shared/components/discard-changes-dialog';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { THEME } from '@/shared/lib/theme';
import { useUnsavedChanges } from '@/shared/lib/use-unsaved-changes';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, Info, ListChecks, Store, Users } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * CHK-06: a checklist's name and schedule. Reached with an id to edit one,
 * without to write a new one.
 */
export function ChecklistEditorScreen() {
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  if (id === undefined) return <EditorForm checklist={null} />;
  return <LoadedEditor id={Number(id)} nameHint={name} />;
}

/** Loads the checklist, and says so when it cannot. */
function LoadedEditor({ id, nameHint }: { id: number; nameHint?: string }) {
  const t = useT();
  const query = useChecklist(id);

  if (query.data)
    return <EditorForm key={query.data.id} checklist={query.data} />;

  const failure = query.isError ? classifyEditorError(query.error) : null;
  return (
    // The name is authored content: shown as typed, never translated.
    <PushedScreen title={nameHint ?? ''} adminOnly backHref="/checklists/admin">
      {failure === 'forbidden' || failure === 'gone' ? (
        <View className="mx-4">
          <Banner
            tone="error"
            message={t(failure === 'gone' ? 'sched.gone' : 'sched.forbidden')}
          />
        </View>
      ) : failure === 'failed' ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="shadow-card border-border bg-card mx-4 gap-3 rounded-3xl border p-4"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11 w-2/3 self-end" />
          <Skeleton className="h-11 w-1/2 self-end" />
        </View>
      )}
    </PushedScreen>
  );
}

function EditorForm({ checklist }: { checklist: ChecklistDetail | null }) {
  const t = useT();
  const theme = useAppliedTheme();
  const router = useRouter();
  const setListNotice = useChecklistNotice((state) => state.setNotice);

  const isNew = checklist === null;
  const id = checklist?.id ?? 0;
  const archivedView = checklist?.is_archived ?? false;
  const initial = checklist ? formFromChecklist(checklist) : EMPTY_FORM;

  const [form, setForm] = React.useState<ScheduleForm>(initial);
  const [submitted, setSubmitted] = React.useState(false);
  const [conflict, setConflict] = React.useState(false);
  const [failure, setFailure] = React.useState<EditorFailure | null>(null);
  const [savedNotice, setSavedNotice] = React.useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [archiveFailed, setArchiveFailed] = React.useState(false);
  const [restoreFailed, setRestoreFailed] = React.useState(false);

  const create = useCreateChecklist();
  const update = useUpdateChecklist(id);
  const archive = useArchiveChecklist(id);
  const restore = useRestoreChecklist(id);
  const saving = create.isPending || update.isPending;

  const guard = useUnsavedChanges({
    initial: normalizeForm(initial),
    current: normalizeForm(form),
    saving,
  });

  const assignments = useAssignments(id, { enabled: !isNew });
  const outlets = useOutlets();
  const running = (assignments.data ?? []).filter((a) => a.is_active);
  const singleOutlet = outlets.data
    ? outlets.data.filter((outlet) => !outlet.is_archived).length <= 1
    : false;
  const teamAssignment = singleOutlet ? running[0] : undefined;
  const members = useMembers(teamAssignment?.id ?? 0, {
    enabled: teamAssignment !== undefined,
  });

  const locked = failure === 'forbidden' || failure === 'gone';
  const disabled = archivedView || locked || saving;

  function edit(patch: Partial<ScheduleForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setSavedNotice(null);
    setFailure(null);
    setConflict(false);
  }

  function save() {
    if (hasProblems(checkForm(form))) {
      setSubmitted(true);
      return;
    }
    const request = toRequest(form);
    const onError = (error: unknown) => {
      const kind = classifyEditorError(error);
      if (kind === 'overlap') setConflict(true);
      else setFailure(kind);
    };
    if (isNew) {
      create.mutate(request, {
        onError,
        // Straight on to the tasks: a checklist with none cannot run.
        onSuccess: (created) =>
          guard.leave(() =>
            router.replace({
              pathname: '/checklists/[id]/tasks',
              params: { id: created.id },
            }),
          ),
      });
    } else {
      update.mutate(request, {
        onError,
        onSuccess: (saved) => {
          setForm(formFromChecklist(saved));
          setSavedNotice(t('sched.saved'));
        },
      });
    }
  }

  /** Back to the admin list, without the "discard?" question. */
  function backToList() {
    guard.leave(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/checklists/admin');
    });
  }

  const name = form.name.trim() || checklist?.name || '';

  function confirmArchiveNow() {
    setConfirmArchive(false);
    setArchiveFailed(false);
    archive.mutate(undefined, {
      onError: () => setArchiveFailed(true),
      onSuccess: (archived) => {
        setListNotice({ kind: 'archived', name: archived.name });
        backToList();
      },
    });
  }

  function restoreNow() {
    setRestoreFailed(false);
    restore.mutate(undefined, {
      onError: () => setRestoreFailed(true),
      onSuccess: (restored) => {
        setListNotice({ kind: 'restored', name: restored.name });
        backToList();
      },
    });
  }

  const taskCount = checklist?.tasks.length ?? 0;
  const rows: SummaryRow[] = [];
  if (checklist) {
    rows.push({
      id: 'tasks',
      icon: ListChecks,
      label: t('sched.tasks'),
      value:
        taskCount === 0
          ? t('chk-list.no-tasks')
          : taskCount === 1
            ? t('chk-list.task-one')
            : format(t('chk-list.task-many'), { n: String(taskCount) }),
      onPress: () =>
        router.push({
          pathname: '/checklists/[id]/tasks',
          params: { id: checklist.id },
        }),
    });
    if (!singleOutlet && assignments.data) {
      rows.push({
        id: 'outlets',
        icon: Store,
        label: t('sched.outlets'),
        value:
          running.length === 0
            ? t('sched.nowhere')
            : running.length === 1
              ? t('sched.runs-at-one')
              : format(t('sched.runs-at-n'), { n: String(running.length) }),
        onPress: () =>
          router.push({
            pathname: '/checklists/[id]/outlets',
            params: { id: checklist.id },
          }),
      });
    }
    if (teamAssignment && members.data) {
      const managers = members.data
        .filter((m) => m.role === 'CL_ADMIN')
        .map((m) => m.full_name);
      const team = members.data.filter((m) => m.role === 'CL_IMP').length;
      const value =
        managers.length > 0
          ? format(
              t(team === 1 ? 'sched.team-value-one' : 'sched.team-value'),
              { who: managers.join(', '), n: String(team) },
            )
          : format(t(team === 1 ? 'sched.team-none-one' : 'sched.team-none'), {
              n: String(team),
            });
      rows.push({
        id: 'team',
        icon: Users,
        label: t('sched.team'),
        value,
        onPress: () =>
          router.push({
            pathname: '/assignments/[id]/members',
            params: {
              id: teamAssignment.id,
              checklist: checklist.name,
              outlet: teamAssignment.outlet_name,
            },
          }),
      });
    }
  }

  const spinner = (
    <ActivityIndicator size="small" color={THEME[theme].primaryForeground} />
  );

  const footer = locked ? undefined : archivedView ? (
    <View className="gap-3">
      {restoreFailed ? (
        <Banner
          tone="error"
          message={`${t('sched.restore-failed')} ${t('common.offline')}`}
        />
      ) : null}
      <Button
        className="w-full"
        disabled={restore.isPending}
        onPress={restoreNow}
      >
        {restore.isPending ? spinner : null}
        <Text>{t('sched.restore')}</Text>
      </Button>
    </View>
  ) : (
    <Button
      className="w-full"
      disabled={saving || (!isNew && !guard.changed)}
      onPress={save}
    >
      {saving ? spinner : null}
      <Text>{t(isNew ? 'sched.save-add' : 'admin.save')}</Text>
    </Button>
  );

  const archiveBody =
    running.length === 0
      ? t('sched.archive-body-nowhere')
      : running.length === 1
        ? t('sched.archive-body-one')
        : format(t('sched.archive-body'), { n: String(running.length) });

  return (
    <PushedScreen
      title={isNew ? t('editor.new-title') : name}
      adminOnly
      backHref="/checklists/admin"
      footer={footer}
    >
      <View className="gap-3 pb-3">
        {failure === 'forbidden' ? (
          <Notice tone="error" text={t('sched.forbidden')} />
        ) : null}
        {failure === 'gone' ? (
          <Notice tone="error" text={t('sched.gone')} />
        ) : null}
        {failure === 'failed' ? (
          <Notice
            tone="error"
            text={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        ) : null}
        {savedNotice ? <Notice tone="notice" text={savedNotice} /> : null}
        {archivedView ? (
          <Notice tone="notice" text={t('sched.archived')} icon={Archive} />
        ) : null}
        {!isNew && !archivedView && running.length > 0 ? (
          <View className="mx-4 flex-row items-start gap-2 px-1">
            <Info className="text-foreground mt-px size-4 shrink-0" />
            <Text className="min-w-0 flex-1 text-[13px] leading-snug">
              {t('sched.edits-apply')}
            </Text>
          </View>
        ) : null}
      </View>

      <ScheduleFields
        form={form}
        onChange={edit}
        submitted={submitted}
        conflict={conflict}
        disabled={disabled}
      />
      {archivedView || locked ? null : (
        <ScheduleSummary form={form} conflict={conflict} />
      )}

      {rows.length > 0 ? <SummaryRows rows={rows} disabled={disabled} /> : null}

      {!isNew && !archivedView && !locked ? (
        <View className="mx-4 mt-8 gap-3">
          {archiveFailed ? (
            <Banner
              tone="error"
              message={`${t('sched.archive-failed')} ${t('common.offline')}`}
            />
          ) : null}
          <Button
            variant="outline"
            className="border-destructive/50 w-full"
            disabled={archive.isPending}
            onPress={() => setConfirmArchive(true)}
          >
            {archive.isPending ? (
              <ActivityIndicator size="small" />
            ) : (
              <Archive className="text-destructive-soft-foreground size-[18px]" />
            )}
            <Text className="text-destructive-soft-foreground">
              {t('sched.archive')}
            </Text>
          </Button>
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmArchive}
        icon={Archive}
        title={format(t('sched.archive-title'), { name })}
        body={archiveBody}
        safe={{
          label: t('admin.cancel'),
          onPress: () => setConfirmArchive(false),
        }}
        other={{
          label: t('sched.archive-confirm'),
          onPress: confirmArchiveNow,
        }}
      />
      <DiscardChangesDialog
        visible={guard.discardOpen}
        onKeepEditing={guard.keepEditing}
        onDiscard={guard.discard}
      />
    </PushedScreen>
  );
}

function Notice({
  tone,
  text,
  icon,
}: {
  tone: 'error' | 'notice';
  text: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <View className="mx-4">
      <Banner tone={tone} message={text} icon={icon} />
    </View>
  );
}
