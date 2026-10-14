import { isSessionExpired, useMe } from '@/features/auth/use-me';
import { useHomeNotice } from '@/features/home/home-notice';
import { clockTime, dayKey } from '@/features/home/run-time';
import { useRuns } from '@/features/home/use-runs';
import { AnswerDisplay, type AnswerView } from '@/features/run/answer-display';
import { CommentSheet } from '@/features/run/comment-sheet';
import { PhotoRow } from '@/features/run/photo-row';
import { RunProgressCard } from '@/features/run/run-progress';
import { TaskRow, TaskRowsSkeleton } from '@/features/run/task-row';
import { useAnswerTask } from '@/features/run/use-answer-task';
import { useCountdown } from '@/features/run/use-countdown';
import { useImageUpload } from '@/features/run/use-image-upload';
import { useRun } from '@/features/run/use-run';
import { ReadingField, parseReading } from '@/features/run/reading-field';
import { YesNo } from '@/features/run/yes-no';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { type RunTask } from '@/shared/api/types';
import { Banner } from '@/shared/components/ui/banner';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Text } from '@/shared/components/ui/text';
import { useNow } from '@/shared/lib/use-now';
import { format, useT } from '@/shared/i18n';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Eye } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

/** A real minus sign, so "−18" doesn't read as a hyphen. */
const signed = (n: number) => String(n).replace('-', '−');

type RowError = { message: string } | null;

/**
 * Run execution (CHK-02 week-5 v2, FE Spec §3.3). Answers are written as
 * they are given; a failing binary or number demands a comment in the same
 * interaction; a photo is judged afterwards, and raises an incident then.
 */
export function RunScreen() {
  const { id, name, outlet } = useLocalSearchParams<{
    id: string;
    name?: string;
    outlet?: string;
  }>();
  const runId = Number(id);
  const { data: me, isError: meError, error: meErr } = useMe();
  const t = useT();
  const router = useRouter();
  const now = useNow(15_000);
  const query = useRun(runId);
  const listed = useRuns().data?.find((run) => run.id === runId);
  const setNotice = useHomeNotice((state) => state.setNotice);
  const answer = useAnswerTask(runId);
  const scrollRef = React.useRef<ScrollView>(null);
  const rowY = React.useRef(new Map<number, number>());
  const listY = React.useRef(0);

  const run = query.data;
  const isSupervisor = run?.my_role === 'CL_ADMIN';
  const closeIso = run?.window_close ?? listed?.window_close;
  const countdown = useCountdown(closeIso);
  const closed = closeIso ? now >= new Date(closeIso).getTime() : false;

  const [drafts, setDrafts] = React.useState<Record<number, string>>({});
  const [rowErrors, setRowErrors] = React.useState<Record<number, RowError>>(
    {},
  );
  const [sheetFor, setSheetFor] = React.useState<number | null>(null);
  const [sheetAnswer, setSheetAnswer] = React.useState<{
    answer_bool?: boolean;
    answer_number?: number;
  }>({});
  const [pendingPhotoTask, setPendingPhotoTask] = React.useState<number | null>(
    null,
  );

  const tasks = run?.tasks ?? [];

  const imageUpload = useImageUpload({
    onSuccess: (key) => {
      if (pendingPhotoTask !== null) {
        void (async () => {
          const task = tasks.find((t) => t.id === pendingPhotoTask);
          if (task) {
            await writeAnswer(task, { image_key: key, comment: null });
          }
          setPendingPhotoTask(null);
        })();
      }
    },
    onError: () => {
      setPendingPhotoTask(null);
    },
  });

  React.useEffect(() => {
    if (pendingPhotoTask !== null && !imageUpload.uploading) {
      void imageUpload.upload(pendingPhotoTask);
    }
  }, [pendingPhotoTask, imageUpload]);

  const answered = tasks.filter((task) => task.answered_at !== null);
  const unanswered = tasks.filter((task) => task.answered_at === null);
  const complete = tasks.length > 0 && unanswered.length === 0;

  const gone = Boolean(run && closed && !isSupervisor);
  const missing = query.isError && !run && isNotFound(query.error);
  React.useEffect(() => {
    if (gone && run) {
      setNotice(format(t('home.closed'), { name: run.checklist_name }));
      router.replace('/home');
    } else if (missing) {
      router.replace('/home');
    }
  }, [gone, missing, run, router, setNotice, t]);

  if (!me) {
    if (meError && isSessionExpired(meErr)) return <Redirect href="/" />;
    return null;
  }
  if (gone || missing) return null;

  const title = run?.checklist_name ?? name ?? '';
  const outletName = run?.outlet_name ?? outlet;

  function limitOf(task: RunTask): string | undefined {
    const unit = task.unit ?? '';
    const { min_value: min, max_value: max } = task;
    if (min !== null && max !== null) {
      return format(t('run.range'), {
        min: signed(min),
        max: signed(max),
        unit,
      }).trim();
    }
    if (max !== null)
      return format(t('run.max'), { max: signed(max), unit }).trim();
    if (min !== null)
      return format(t('run.min'), { min: signed(min), unit }).trim();
    return undefined;
  }

  function answerOf(task: RunTask): AnswerView | undefined {
    if (task.answered_at === null) return undefined;
    if (task.answer_type === 'IMAGE') {
      return { kind: 'photo', label: t('run.photo-taken') };
    }
    if (task.answer_type === 'BINARY') {
      return task.answer_bool
        ? { kind: 'yes', label: t('run.yes') }
        : { kind: 'no', label: t('run.no'), comment: task.comment };
    }
    const inRange = task.outcome !== 'FAIL';
    return {
      kind: 'reading',
      value: `${signed(task.answer_number ?? 0)} ${task.unit ?? ''}`.trim(),
      inRange,
      rangeLabel: t(inRange ? 'run.in-range' : 'run.out-of-range'),
      limit: limitOf(task),
      comment: task.comment,
    };
  }

  function attributionOf(task: RunTask): string | undefined {
    if (!task.answered_by || !task.answered_at) return undefined;
    const who =
      task.answered_by.id === me!.user.id
        ? t('run.you')
        : task.answered_by.full_name;
    return `${who} · ${clockTime(task.answered_at)}`;
  }

  async function writeAnswer(
    task: RunTask,
    request: {
      answer_bool?: boolean;
      answer_number?: number;
      image_key?: string;
      comment?: string | null;
    },
  ): Promise<boolean> {
    const verify = isSupervisor ? false : true;
    if (!verify) return false;
    try {
      setRowErrors((current) => ({ ...current, [task.id]: null }));
      await answer.mutateAsync({ taskId: task.id, request });
      return true;
    } catch (error) {
      const message =
        error instanceof Error && 'body' in error
          ? ((error as { body?: { error?: { message?: string } } }).body?.error
              ?.message ?? t('run.write-failed'))
          : t('run.write-failed');
      setRowErrors((current) => ({ ...current, [task.id]: { message } }));
      return false;
    }
  }

  async function answerBinary(task: RunTask, value: boolean) {
    if (value) {
      await writeAnswer(task, { answer_bool: true, comment: null });
      return;
    }
    if (task.requires_comment_on_fail) {
      setSheetAnswer({ answer_bool: false });
      setSheetFor(task.id);
    } else {
      await writeAnswer(task, { answer_bool: false, comment: null });
    }
  }

  async function answerReading(task: RunTask) {
    const draft = drafts[task.id] ?? '';
    const parsed = parseReading(draft);
    if (parsed === null) return;
    await writeAnswer(task, { answer_number: parsed, comment: null });
  }

  async function saveComment(task: RunTask, text: string) {
    const written = await writeAnswer(task, {
      ...sheetAnswer,
      comment: text,
    });
    if (written) {
      setDrafts((current) => {
        const { [task.id]: _dropping, ...rest } = current;
        return rest;
      });
    }
    setSheetFor(null);
    setSheetAnswer({});
  }

  function jumpToFirstUnanswered() {
    const first = unanswered[0];
    const y = first ? rowY.current.get(first.id) : undefined;
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: listY.current + y - 8, animated: true });
    }
  }

  const unansweredLabel =
    unanswered.length === 1
      ? t('run.not-answered-count.one')
      : format(t('run.not-answered-count.many'), {
          n: String(unanswered.length),
        });

  const showCard = Boolean(closeIso) && !(query.isError && !run);
  const isAnswering = !isSupervisor && !closed;

  return (
    <PushedScreen title={title} backHref="/home" scrollRef={scrollRef}>
      {outletName ? (
        <Text className="font-sans-medium -mt-2 mb-3 px-5 text-[14px]">
          {outletName}
        </Text>
      ) : null}

      {query.isError ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : null}

      {showCard && closeIso ? (
        <RunProgressCard
          closes={countdown.label || closedLabelOf(closeIso, now, t)}
          progressLabel={
            run
              ? `${format(t('run.answered'), {
                  n: String(answered.length),
                  total: String(tasks.length),
                })}${complete ? ` · ${t('home.complete')}` : ''}`
              : ''
          }
          value={answered.length}
          total={tasks.length}
        >
          {complete && closeIso ? (
            <Text className="text-muted-foreground mt-2 px-1 text-[13px]">
              {format(t('run.you-can-change'), {
                time: clockTime(closeIso),
              })}
            </Text>
          ) : null}
          {isSupervisor && run ? (
            <View className="mt-2 items-start gap-2 px-1">
              {closed ? null : (
                <View className="flex-row items-start gap-1.5">
                  <Eye className="text-foreground mt-0.5 size-4 shrink-0" />
                  <Text className="font-sans-medium min-w-0 flex-1 text-[13px] leading-snug">
                    {t('run.watching')}
                  </Text>
                </View>
              )}
              {unanswered.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${unansweredLabel}. ${t('run.jump')}`}
                  onPress={jumpToFirstUnanswered}
                  className="border-input-edge bg-card active:bg-accent min-h-11 justify-center rounded-full border px-3.5"
                >
                  <Text className="font-sans-semibold text-[13px]">
                    {unansweredLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </RunProgressCard>
      ) : null}

      {closed && isSupervisor && run ? (
        <View className="mx-4 mb-3">
          <Banner
            tone="notice"
            message={format(t('run.closed-at'), {
              name: run.checklist_name,
              time: clockTime(run.window_close),
            })}
          />
        </View>
      ) : null}

      {!run && !query.isError ? (
        <TaskRowsSkeleton rows={5} />
      ) : run ? (
        <View
          onLayout={(e) => {
            listY.current = e.nativeEvent.layout.y;
          }}
          className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border"
        >
          {run.tasks.map((task, index) => {
            const answerView = answerOf(task);
            const open = task.answered_at === null;
            const rowError = rowErrors[task.id];
            const isImage = task.answer_type === 'IMAGE';
            const isReading = task.answer_type === 'NUMBER';
            const isBinary = task.answer_type === 'BINARY';
            const sheetOpen = sheetFor === task.id;

            return (
              <View key={task.id}>
                <TaskRow
                  first={index === 0}
                  position={task.position}
                  text={task.text}
                  answer={
                    !isAnswering || (isReading && open) ? (
                      answerView ? (
                        <AnswerDisplay {...answerView} />
                      ) : undefined
                    ) : undefined
                  }
                  attribution={attributionOf(task)}
                  notAnsweredLabel={
                    isSupervisor && open ? t('run.not-answered') : undefined
                  }
                  onLayout={(y) => rowY.current.set(task.id, y)}
                >
                  {isAnswering && open ? (
                    <View className="mt-2 gap-2">
                      {isBinary ? (
                        <YesNo
                          answer={null}
                          onAnswer={(value) => void answerBinary(task, value)}
                        />
                      ) : null}
                      {isReading ? (
                        <ReadingField
                          draft={drafts[task.id] ?? ''}
                          unit={task.unit}
                          limit={limitOf(task)}
                          error={rowError?.message}
                          onDraftChange={(text) =>
                            setDrafts((current) => ({
                              ...current,
                              [task.id]: text,
                            }))
                          }
                          onSubmit={() => void answerReading(task)}
                        />
                      ) : null}
                      {isImage ? (
                        <PhotoRow
                          url={task.image_url || imageUpload.url}
                          uploading={
                            pendingPhotoTask === task.id ||
                            imageUpload.uploading
                          }
                          failed={
                            Boolean(rowError) || Boolean(imageUpload.error)
                          }
                          onCapture={() => setPendingPhotoTask(task.id)}
                          onRetake={() => setPendingPhotoTask(task.id)}
                          onAddComment={() => setSheetFor(task.id)}
                        />
                      ) : null}
                      {!isImage && rowError?.message ? (
                        <Text className="font-sans-medium text-[13px] text-destructive-soft-foreground">
                          {rowError.message}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </TaskRow>
                {sheetOpen ? (
                  <CommentSheet
                    visible={sheetOpen}
                    title={task.text}
                    context={limitOf(task)}
                    initialValue={task.comment ?? ''}
                    key={`sheet-${task.id}-${sheetAnswer.answer_bool ?? ''}`}
                    onClose={() => setSheetFor(null)}
                    onSave={(comment) => void saveComment(task, comment)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </PushedScreen>
  );
}

function closedLabelOf(
  closeIso: string,
  now: number,
  t: ReturnType<typeof useT>,
): string {
  return format(
    t(dayKey(closeIso, now, 'home.closes', 'home.closes-tomorrow')),
    { time: clockTime(closeIso) },
  );
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: number }).status === 404
  );
}
