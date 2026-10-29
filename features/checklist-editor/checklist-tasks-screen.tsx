import {
  useAssignOutlets,
  useAssignments,
} from '@/features/assignments/use-assignments';
import {
  classifyEditorError,
  isTextRejected,
} from '@/features/checklist-editor/checklist-errors';
import {
  EMPTY_TASK_FORM,
  formFromTask,
  showNumber,
  toCreateRequest,
  toUpdateRequest,
  type TaskForm,
} from '@/features/checklist-editor/task-form';
import { TaskSheet } from '@/features/checklist-editor/task-sheet';
import { TYPE_ICON } from '@/features/checklist-editor/task-type-icon';
import { useChecklist } from '@/features/checklist-editor/use-checklist';
import {
  useChecklistTasks,
  useCreateTask,
  useRemoveTask,
  useReorderTasks,
  useUpdateTask,
} from '@/features/checklist-editor/use-tasks';
import { useOutlets } from '@/features/outlets/use-outlets';
import { PushedScreen } from '@/features/shell/pushed-screen';
import type { Task } from '@/shared/api/types';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SkeletonRows } from '@/shared/components/skeleton';
import { SortableList } from '@/shared/components/sortable-list';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, Info, ListChecks, Plus, Trash } from 'lucide-react-native';
import * as React from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';

type Sheet = { mode: 'new' } | { mode: 'edit'; task: Task };
type Failure = 'reorder' | 'remove' | null;

/** CHK-09: the tasks of one checklist, in order. */
export function ChecklistTasksScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const checklistId = Number(params.id);

  const checklist = useChecklist(checklistId);
  const tasksQuery = useChecklistTasks(checklistId);
  const assignments = useAssignments(checklistId);
  const outlets = useOutlets();
  const create = useCreateTask(checklistId);
  const update = useUpdateTask(checklistId);
  const remove = useRemoveTask(checklistId);
  const reorder = useReorderTasks(checklistId);
  const assign = useAssignOutlets(checklistId);

  const [sheet, setSheet] = React.useState<Sheet | null>(null);
  const [sheetFailed, setSheetFailed] = React.useState(false);
  const [textRejected, setTextRejected] = React.useState(false);
  const [removeId, setRemoveId] = React.useState<number | null>(null);
  const [failure, setFailure] = React.useState<Failure>(null);
  const [retryOrder, setRetryOrder] = React.useState<number[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [startFailed, setStartFailed] = React.useState(false);

  const tasks = tasksQuery.data ?? [];
  const name = checklist.data?.name ?? '';
  const archived = checklist.data?.is_archived ?? false;
  const running = (assignments.data ?? []).filter((a) => a.is_active);
  const assigned = running.length > 0;
  const liveOutlets = (outlets.data ?? []).filter((o) => !o.is_archived);
  // A one-outlet business has no Outlets screen; the checklist is started here.
  const startMode =
    liveOutlets.length === 1 && assignments.isSuccess && !assigned;

  const loadFailure = tasksQuery.isError
    ? classifyEditorError(tasksQuery.error)
    : checklist.isError && !checklist.data
      ? classifyEditorError(checklist.error)
      : null;
  const locked = loadFailure === 'forbidden' || loadFailure === 'gone';
  const readOnly = locked || archived;
  const loading = tasksQuery.isPending && !tasksQuery.isError;
  const lastTask = assigned && tasks.length === 1;

  function describe(task: Task): string {
    const parts = [t(`task.type.${task.answer_type}` as MessageKey)];
    if (task.answer_type === 'NUMBER') {
      if (task.unit) parts.push(task.unit);
      const { min_value: min, max_value: max } = task;
      parts.push(
        min === null && max === null
          ? t('task.log-only-short')
          : min === null
            ? format(t('task.max'), { max: showNumber(max) })
            : max === null
              ? format(t('task.min'), { min: showNumber(min) })
              : format(t('task.range'), {
                  min: showNumber(min),
                  max: showNumber(max),
                }),
      );
    }
    if (task.weight !== 5) {
      parts.push(format(t('task.weight-n'), { n: String(task.weight) }));
    }
    return parts.join(' · ');
  }

  function openSheet(next: Sheet) {
    setSheetFailed(false);
    setTextRejected(false);
    setSheet(next);
  }

  function submitTask(form: TaskForm) {
    const onError = (error: unknown) => {
      if (isTextRejected(error)) setTextRejected(true);
      else setSheetFailed(true);
    };
    const done = (text: string, key: 'task.added' | 'task.saved-one') => {
      setSheet(null);
      AccessibilityInfo.announceForAccessibility(format(t(key), { text }));
    };
    if (sheet?.mode === 'edit') {
      update.mutate(
        { id: sheet.task.id, ...toUpdateRequest(form) },
        { onError, onSuccess: (saved) => done(saved.text, 'task.saved-one') },
      );
    } else {
      create.mutate(toCreateRequest(form), {
        onError,
        onSuccess: (added) => done(added.text, 'task.added'),
      });
    }
  }

  function saveOrder(ids: number[]) {
    setFailure(null);
    setRetryOrder(ids);
    reorder.mutate({ task_ids: ids }, { onError: () => setFailure('reorder') });
  }

  function removeNow(id: number) {
    setRemoveId(null);
    setFailure(null);
    remove.mutate(id, { onError: () => setFailure('remove') });
  }

  function startRunning() {
    const outlet = liveOutlets[0];
    if (!outlet) return;
    setStartFailed(false);
    assign.mutate([outlet.id], {
      onError: () => setStartFailed(true),
      onSuccess: (rows) => {
        // The reply lists every assignment of the checklist, not only this one.
        const row = rows.find((r) => r.outlet.id === outlet.id);
        if (!row) {
          setStartFailed(true);
          return;
        }
        router.push({
          pathname: '/assignments/[id]/members',
          params: { id: row.id, checklist: name, outlet: outlet.name },
        });
      },
    });
  }

  const addButton = (variant: 'default' | 'outline') => (
    <Button
      variant={variant}
      className="w-full"
      onPress={() => openSheet({ mode: 'new' })}
    >
      <Plus className="text-primary-foreground size-4" />
      <Text>{t('task.add')}</Text>
    </Button>
  );

  const footer = readOnly ? undefined : startMode ? (
    <View className="gap-2">
      {startFailed ? (
        <Banner
          tone="error"
          message={`${t('admin.save-failed')} ${t('common.offline')}`}
        />
      ) : null}
      <Button
        className="w-full"
        variant={tasks.length === 0 ? 'outline' : 'default'}
        disabled={tasks.length === 0 || assign.isPending}
        onPress={startRunning}
      >
        <Text>{t('task.start-running')}</Text>
      </Button>
      {tasks.length === 0 ? (
        <Text className="text-center text-[13px]">{t('task.add-first')}</Text>
      ) : null}
    </View>
  ) : tasks.length > 0 ? (
    addButton('default')
  ) : undefined;

  let body: React.ReactNode;
  if (loading) {
    body = <SkeletonRows count={6} />;
  } else if (locked) {
    body = null;
  } else if (tasks.length === 0) {
    body = (
      <EmptyState
        icon={ListChecks}
        title={t('task.empty-title')}
        body={t('task.empty-body')}
        action={
          archived ? undefined : (
            <Button onPress={() => openSheet({ mode: 'new' })}>
              <Plus className="text-primary-foreground size-4" />
              <Text>{t('task.add')}</Text>
            </Button>
          )
        }
      />
    );
  } else {
    body = (
      <>
        <View className="mx-4">
          <SortableList
            items={tasks}
            keyOf={(task) => task.id}
            labelOf={(task) => task.text}
            disabled={readOnly}
            onDragChange={setDragging}
            onReorder={(next) => saveOrder(next.map((task) => task.id))}
            actionsFor={(task) => [
              {
                key: 'remove',
                label: t('task.remove'),
                destructive: true,
                disabled: lastTask,
                hint: lastTask ? t('task.need-one') : undefined,
                onPress: () => setRemoveId(task.id),
              },
            ]}
            renderItem={(task) => {
              const TypeIcon = TYPE_ICON[task.answer_type];
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={format(t('task.edit'), {
                    text: task.text,
                  })}
                  disabled={readOnly}
                  onPress={() => openSheet({ mode: 'edit', task })}
                  className="flex-row items-start gap-2.5 pr-1"
                >
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans-medium text-[15px] leading-snug">
                      {task.text}
                    </Text>
                    <View className="mt-0.5 flex-row items-start gap-1.5">
                      <TypeIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                      <Text className="text-muted-foreground min-w-0 flex-1 text-[13px] leading-snug">
                        {describe(task)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
        {startMode && !readOnly ? (
          <View className="mx-4 mt-4">{addButton('outline')}</View>
        ) : null}
      </>
    );
  }

  const sheetInitial =
    sheet?.mode === 'edit' ? formFromTask(sheet.task) : EMPTY_TASK_FORM;

  return (
    <PushedScreen
      title={name}
      eyebrow={t('editor.tasks-title')}
      adminOnly
      backHref="/checklists/admin"
      scrollEnabled={!dragging}
      footer={footer}
    >
      <View className="gap-3 pb-3">
        {loadFailure === 'forbidden' ? (
          <Notice tone="error" text={t('sched.forbidden')} />
        ) : null}
        {loadFailure === 'gone' ? (
          <Notice tone="error" text={t('sched.gone')} />
        ) : null}
        {archived ? (
          <Notice tone="notice" text={t('sched.archived')} icon={Archive} />
        ) : null}
        {loadFailure === 'failed' ? (
          <RetryBanner
            message={t('common.offline')}
            retryLabel={t('common.retry')}
            onRetry={() => {
              void tasksQuery.refetch();
              void checklist.refetch();
            }}
            retrying={tasksQuery.isRefetching}
          />
        ) : null}
        {failure === 'reorder' ? (
          <View className="mx-4 gap-2">
            <Banner tone="error" message={t('task.reorder-failed')} />
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onPress={() => saveOrder(retryOrder)}
            >
              <Text>{t('task.try-again')}</Text>
            </Button>
          </View>
        ) : null}
        {failure === 'remove' ? (
          <Notice tone="error" text={t('task.remove-failed')} />
        ) : null}
        {assigned && tasks.length > 0 && !archived ? (
          <View className="mx-4 flex-row items-start gap-2 px-1">
            <Info className="text-foreground mt-px size-4 shrink-0" />
            <Text className="min-w-0 flex-1 text-[13px] leading-snug">
              {t('sched.edits-apply')}
            </Text>
          </View>
        ) : null}
      </View>

      {body}

      <TaskSheet
        visible={sheet !== null}
        mode={sheet?.mode ?? 'new'}
        initial={sheetInitial}
        assigned={assigned}
        saving={create.isPending || update.isPending}
        failed={sheetFailed}
        textRejected={textRejected}
        onEdited={() => {
          setSheetFailed(false);
          setTextRejected(false);
        }}
        onSubmit={submitTask}
        onClose={() => setSheet(null)}
      />
      <ConfirmDialog
        visible={removeId !== null}
        icon={Trash}
        title={t('task.remove-title')}
        body={
          assigned
            ? `${t('task.remove-body')} ${t('sched.edits-apply')}`
            : t('task.remove-body')
        }
        safe={{ label: t('admin.cancel'), onPress: () => setRemoveId(null) }}
        other={{
          label: t('task.remove'),
          onPress: () => removeId !== null && removeNow(removeId),
        }}
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
