import { useMe } from '@/features/auth/use-me';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import { useQueuedWrites } from '@/shared/api/query-helpers';
import type { RunTask } from '@/shared/api/types';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TaskRowsSkeleton } from '@/features/run/task-row';
import { canAdminister } from '@/shared/constants/roles';
import { format, useT } from '@/shared/i18n';
import { formatDay, toDay } from '@/shared/lib/date-range';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useLocalSearchParams } from 'expo-router';
import {
  Camera,
  Check,
  CircleMinus,
  CircleX,
  Clock,
  Hourglass,
  Zap,
} from 'lucide-react-native';
import * as React from 'react';
import { Image, View } from 'react-native';

import { scorePercent } from './issue-card';
import { RESOLVE_KEY, type ResolveVariables } from './issue-keys';
import { useIncident, useResolveIncident } from './use-incident';

/** A real minus sign, so "−18" doesn't read as a hyphen. */
const signed = (n: number) => String(n).replace('-', '−');

function TaskItem({
  task,
  first,
  answer,
}: {
  task: RunTask;
  first: boolean;
  answer?: string;
}) {
  const t = useT();
  const formatClock = useFormatClock();
  return (
    <View
      className={
        first ? 'gap-1.5 px-4 py-3' : 'border-border gap-1.5 border-t px-4 py-3'
      }
    >
      <View className="flex-row flex-wrap items-start gap-x-3 gap-y-1.5">
        <Text className="min-w-[10rem] flex-1 basis-[10rem] text-[15px] leading-snug">
          {task.text}
        </Text>
        {task.outcome === 'MISSED' ? (
          <View className="bg-muted flex-row items-center gap-1 rounded-full px-2.5 py-1">
            <CircleMinus className="text-foreground size-4" />
            <Text className="font-sans-semibold text-[13px]">
              {t('iss.not-answered')}
            </Text>
          </View>
        ) : null}
      </View>
      {task.answer_type === 'IMAGE' && task.outcome !== 'MISSED' ? (
        task.image_url ? (
          <Image
            accessibilityLabel={t('iss.photo')}
            source={{ uri: task.image_url }}
            className="bg-muted h-40 w-full rounded-2xl"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-row items-center gap-1.5">
            <Camera className="text-foreground size-4" />
            <Text className="text-[14px]">{t('iss.photo')}</Text>
          </View>
        )
      ) : null}
      {answer ? (
        <Text className="font-sans-semibold text-[15px] leading-snug">
          {answer}
        </Text>
      ) : null}
      {task.comment ? (
        <Text className="text-[14px] leading-snug">“{task.comment}”</Text>
      ) : null}
      {task.answered_by && task.answered_at && task.outcome !== 'MISSED' ? (
        <Text className="text-muted-foreground text-[13px] leading-snug">
          {format(t('iss.by-at'), {
            name: task.answered_by.full_name,
            time: formatClock(isoToClock(task.answered_at)),
          })}
        </Text>
      ) : null}
    </View>
  );
}

function Group({
  icon: Icon,
  title,
  tasks,
  answerOf,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tasks: RunTask[];
  answerOf: (task: RunTask) => string | undefined;
}) {
  if (tasks.length === 0) return null;
  return (
    <View className="mb-4">
      <View
        accessibilityRole="header"
        className="mx-5 mb-2 flex-row items-center gap-1.5"
      >
        <Icon className="text-foreground size-4" />
        <Text className="font-sans-semibold text-[14px]">
          {title} · {tasks.length}
        </Text>
      </View>
      <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
        {tasks.map((task, index) => (
          <TaskItem
            key={task.id}
            task={task}
            first={index === 0}
            answer={answerOf(task)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Issue detail (ISS-02, FE Spec §3.6): every failed or missed task of one run,
 * with its comment and who answered it, and "Mark resolved" for the Checklist
 * Manager. Resolving is acknowledgement: the score never moves.
 */
export function IssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const incidentId = Number(id);
  const { data: me } = useMe();
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const formatClock = useFormatClock();
  const query = useIncident(incidentId);
  const resolve = useResolveIncident();
  const queued = useQueuedWrites<ResolveVariables>(RESOLVE_KEY, (variables) =>
    String(variables.incidentId),
  );
  const [confirming, setConfirming] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [goneAfterResolve, setGoneAfterResolve] = React.useState(false);

  if (!me) return null;

  const incident = query.data;
  const waiting = queued.some(
    (write) =>
      write.kind === 'waiting' && write.variables.incidentId === incidentId,
  );
  const gone =
    goneAfterResolve ||
    (query.isError &&
      !incident &&
      query.error instanceof ApiError &&
      query.error.status === 404);
  const loadFailed = query.isError && !incident && !gone;
  // ADMIN and OWNER read; the Checklist Manager of the assignment resolves.
  const canResolve = !canAdminister(me.user.tenant_role);

  const when = (iso: string) =>
    `${formatDay(toDay(new Date(iso)), language)}, ${formatClock(isoToClock(iso))}`;

  function doResolve() {
    setConfirming(false);
    setNotice(null);
    resolve.mutate(
      { incidentId },
      {
        onSuccess: (result) => {
          // Someone got there first: the platform kept their resolution.
          if (result.resolved_by && result.resolved_by.id !== me!.user.id) {
            setNotice(t('iss.already'));
          }
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 404) {
            setGoneAfterResolve(true);
          } else {
            setNotice(t('iss.detail-failed'));
          }
        },
      },
    );
  }

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
    if (max !== null) {
      return format(t('run.max'), { max: signed(max), unit }).trim();
    }
    if (min !== null) {
      return format(t('run.min'), { min: signed(min), unit }).trim();
    }
    return undefined;
  }

  function answerOf(task: RunTask): string | undefined {
    if (task.answer_type === 'BINARY' && task.answer_bool !== null) {
      return task.answer_bool ? t('run.yes') : t('run.no');
    }
    if (task.answer_type === 'NUMBER' && task.answer_number !== null) {
      const value = `${signed(task.answer_number)} ${task.unit ?? ''}`.trim();
      const limit = limitOf(task);
      return limit ? format(t('iss.limit'), { value, limit }) : value;
    }
    return undefined;
  }

  const failed =
    incident?.tasks.filter((task) => task.outcome === 'FAIL') ?? [];
  const missed =
    incident?.tasks.filter((task) => task.outcome === 'MISSED') ?? [];
  const assessing =
    incident?.tasks.filter((task) => task.outcome === 'PENDING_JUDGEMENT') ??
    [];

  const resolvedLine =
    incident?.status === 'RESOLVED' && incident.resolved_at ? (
      <View className="flex-row items-center gap-1.5">
        <Check className="text-foreground size-5 shrink-0" strokeWidth={2.5} />
        <Text className="font-sans-semibold min-w-0 shrink text-[15px] leading-snug">
          {format(t('iss.resolved-by'), {
            name: incident.resolved_by?.full_name ?? '',
            when: when(incident.resolved_at),
          })}
        </Text>
      </View>
    ) : null;

  return (
    <PushedScreen
      title={incident?.checklist.name ?? ''}
      eyebrow={t('iss.eyebrow')}
      backHref="/issues"
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      {gone ? (
        <View className="mx-4 gap-3">
          <Banner tone="notice" message={t('iss.gone')} />
        </View>
      ) : loadFailed ? (
        <View className="mx-4 gap-2">
          <Banner tone="error" message={t('iss.detail-failed')} />
          <Button
            variant="outline"
            className="self-start"
            onPress={() => void query.refetch()}
          >
            <Text>{t('iss.try-again')}</Text>
          </Button>
        </View>
      ) : !incident ? (
        <TaskRowsSkeleton rows={4} />
      ) : (
        <View>
          <View className="mx-5 mb-4">
            <Text className="text-[14px] leading-snug">
              {incident.outlet.name} ·{' '}
              {formatDay(toDay(new Date(incident.window_open)), language)}
            </Text>
            <Text className="font-sans-semibold mt-1 text-[32px] leading-none">
              {scorePercent(incident.score)}
            </Text>
            {incident.rushed ? (
              <View className="mt-2 flex-row items-center gap-1.5">
                <Zap className="text-foreground size-4" />
                <Text className="font-sans-semibold text-[14px]">
                  {t('iss.rushed')}
                </Text>
              </View>
            ) : null}
          </View>
          {notice ? (
            <View className="mx-4 mb-3" accessibilityLiveRegion="polite">
              <Banner tone="notice" message={notice} />
            </View>
          ) : null}
          <Group
            icon={CircleX}
            title={t('iss.failed-group')}
            tasks={failed}
            answerOf={answerOf}
          />
          <Group
            icon={CircleMinus}
            title={t('iss.missed-group')}
            tasks={missed}
            answerOf={answerOf}
          />
          <Group
            icon={Hourglass}
            title={t('iss.other-group')}
            tasks={assessing}
            answerOf={answerOf}
          />
          <View className="mx-4 mt-2">
            {resolvedLine ? (
              resolvedLine
            ) : waiting ? (
              <View className="bg-pending-soft flex-row items-center gap-2 self-start rounded-full px-3 py-1.5">
                <Clock className="text-pending-soft-foreground size-4 shrink-0" />
                <Text className="font-sans-semibold text-pending-soft-foreground text-[14px]">
                  {t('iss.waiting')}
                </Text>
              </View>
            ) : canResolve ? (
              <View>
                <Text className="mb-3 text-[14px] leading-snug">
                  {format(t('iss.score-line'), {
                    score: scorePercent(incident.score),
                  })}
                </Text>
                <Button
                  className="w-full"
                  disabled={resolve.isPending}
                  onPress={() => setConfirming(true)}
                >
                  <Text>{t('iss.mark-resolved')}</Text>
                </Button>
              </View>
            ) : null}
          </View>
        </View>
      )}
      <ConfirmDialog
        visible={confirming}
        icon={Check}
        title={t('iss.confirm-title')}
        safe={{ label: t('admin.cancel'), onPress: () => setConfirming(false) }}
        other={{ label: t('iss.resolve'), onPress: doResolve }}
      />
    </PushedScreen>
  );
}
