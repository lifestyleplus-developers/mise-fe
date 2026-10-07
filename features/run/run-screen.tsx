import { isSessionExpired, useMe } from '@/features/auth/use-me';
import { useHomeNotice } from '@/features/home/home-notice';
import { clockTime, dayKey } from '@/features/home/run-time';
import { useRuns } from '@/features/home/use-runs';
import { AnswerDisplay, type AnswerView } from '@/features/run/answer-display';
import { RunProgressCard } from '@/features/run/run-progress';
import { TaskRow, TaskRowsSkeleton } from '@/features/run/task-row';
import { useRun } from '@/features/run/use-run';
import { PushedScreen } from '@/features/shell/pushed-screen';
import type { RunTask } from '@/shared/api/types';
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

/** Run execution (CHK-02, FE Spec §3.3). Answer controls arrive in week 5. */
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
  const scrollRef = React.useRef<ScrollView>(null);
  const rowY = React.useRef(new Map<number, number>());
  const listY = React.useRef(0);

  const run = query.data;
  const isSupervisor = run?.my_role === 'CL_ADMIN';
  const closeIso = run?.window_close ?? listed?.window_close;
  const closed = closeIso ? now >= new Date(closeIso).getTime() : false;

  // A run nothing can be done about is not shown to an implementer (§7). A
  // supervisor keeps the final state.
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
  const tasks = run?.tasks ?? [];
  const answered = tasks.filter((task) => task.answered_at !== null);
  const unanswered = tasks.filter((task) => task.answered_at === null);
  const complete = tasks.length > 0 && unanswered.length === 0;

  const closesLabel = closeIso
    ? closed
      ? format(t('run.closed'), { time: clockTime(closeIso) })
      : format(
          t(dayKey(closeIso, now, 'home.closes', 'home.closes-tomorrow')),
          { time: clockTime(closeIso) },
        )
    : undefined;

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

      {showCard && closesLabel ? (
        <RunProgressCard
          closes={closesLabel}
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
          {tasks.map((task, index) => {
            const answer = answerOf(task);
            const open = task.answered_at === null;
            return (
              <TaskRow
                key={task.id}
                first={index === 0}
                position={task.position}
                text={task.text}
                answer={answer ? <AnswerDisplay {...answer} /> : undefined}
                attribution={attributionOf(task)}
                notAnsweredLabel={
                  isSupervisor && open ? t('run.not-answered') : undefined
                }
                controlPlaceholder={
                  !isSupervisor && open ? t('run.week5') : undefined
                }
                onLayout={(y) => rowY.current.set(task.id, y)}
              />
            );
          })}
        </View>
      ) : null}
    </PushedScreen>
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
