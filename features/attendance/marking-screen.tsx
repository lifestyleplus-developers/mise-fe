import { MarkingSession } from '@/features/attendance/marking-session';
import { daysUntil, soonestOpening } from '@/features/attendance/next-opening';
import { useAttendanceConfigs } from '@/features/attendance/use-attendance-configs';
import { useAttendanceOutlets } from '@/features/attendance/use-attendance-outlets';
import { useOpenSessions } from '@/features/attendance/use-attendance-sessions';
import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { AttendanceConfig, AttendanceSession } from '@/shared/api/types';
import { EmptyState } from '@/shared/components/empty-state';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton } from '@/shared/components/skeleton';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarClock,
  ClipboardCheck,
  SlidersHorizontal,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/**
 * Marking (ATT-01). The session to mark is, in order: the one a notification
 * named (`?session=`), the one chosen from the list when several are open, or the
 * only one open. With none open it says when the next one opens.
 */
export function MarkingScreen() {
  const t = useT();
  const router = useRouter();
  const { session: sessionParam } = useLocalSearchParams<{
    session?: string;
  }>();
  const { data: me } = useMe();
  const open = useOpenSessions();
  const outlets = useAttendanceOutlets();
  const setModulesNotice = useModulesNotice((state) => state.setNotice);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [listed, setListed] = React.useState(false);

  const sessions = open.data ?? [];
  const explicit = sessionParam ? Number(sessionParam) : null;
  const selected = listed
    ? picked
    : (picked ?? explicit ?? (sessions.length === 1 ? sessions[0].id : null));

  const noneOpen = open.isSuccess && sessions.length === 0 && selected === null;
  const configs = useAttendanceConfigs(undefined, {
    enabled: noneOpen,
  });
  const pull = usePullToRefresh(() => {
    void open.refetch();
    void configs.refetch();
  });

  const moduleOff =
    (open.isError &&
      open.error instanceof ApiError &&
      open.error.status === 404) ||
    (!outlets.isPending &&
      !outlets.isError &&
      outlets.outlets.length === 0 &&
      open.isSuccess);
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.attendance-off'), { outlet: me?.business.name ?? '' }),
    );
    router.replace('/modules');
  }, [moduleOff, me?.business.name, router, setModulesNotice, t]);

  if (selected !== null) {
    return (
      <MarkingSession
        key={selected}
        sessionId={selected}
        action={
          sessions.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setListed(true);
                setPicked(null);
              }}
              className="active:bg-accent min-h-11 justify-center rounded-full px-3"
            >
              <Text className="font-sans-semibold text-[14px]">
                {t('att.open-now')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
    );
  }

  return (
    <PushedScreen
      title={t('modules.marking')}
      eyebrow={t('modules.attendance')}
      backHref="/modules"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
    >
      {open.isError ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void open.refetch()}
          retrying={open.isRefetching}
        />
      ) : null}
      {open.isPending ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="gap-3"
        >
          {[0, 1].map((key) => (
            <View
              key={key}
              className="shadow-card border-border bg-card mx-4 gap-2 rounded-3xl border px-4 py-3"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </View>
          ))}
        </View>
      ) : sessions.length > 1 ? (
        <SessionList
          sessions={sessions}
          onPick={(id) => {
            setListed(false);
            setPicked(id);
          }}
        />
      ) : noneOpen ? (
        <NothingOpen
          loading={configs.isPending}
          configs={configs.data ?? []}
          admin={me ? canAdminister(me.user.tenant_role) : false}
          outletName={
            outlets.outlets.length === 1
              ? outlets.outlets[0].name
              : (me?.business.name ?? '')
          }
        />
      ) : null}
    </PushedScreen>
  );
}

/** Two or more sessions open at once: choose which to mark. */
function SessionList({
  sessions,
  onPick,
}: {
  sessions: AttendanceSession[];
  onPick: (id: number) => void;
}) {
  const t = useT();
  const formatClock = useFormatClock();
  return (
    <View className="gap-3">
      {sessions.map((session) => (
        <Pressable
          key={session.id}
          accessibilityRole="button"
          onPress={() => onPick(session.id)}
          className="shadow-card border-border bg-card active:bg-accent mx-4 min-h-16 rounded-3xl border px-4 py-3"
        >
          <Text className="font-sans-semibold text-[16px] leading-snug">
            {session.config_name}
          </Text>
          <Text className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
            {`${session.outlet_name} · ${format(t('att.closes'), {
              time: formatClock(isoToClock(session.window_close)),
            })}`}
          </Text>
          <View className="mt-1 flex-row flex-wrap gap-x-3">
            <Text className="font-sans-semibold text-[13px]">
              {format(t('att.n-present'), {
                n: String(session.counts.present),
              })}
            </Text>
            {session.counts.unmarked > 0 ? (
              <Text className="text-[13px]">
                {format(t('att.n-not-marked-yet'), {
                  n: String(session.counts.unmarked),
                })}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** No session open: when the next one opens, or that none is set up. */
function NothingOpen({
  loading,
  configs,
  admin,
  outletName,
}: {
  loading: boolean;
  configs: AttendanceConfig[];
  admin: boolean;
  outletName: string;
}) {
  const t = useT();
  const router = useRouter();
  const formatClock = useFormatClock();
  if (loading) return null;

  const next = soonestOpening(configs);
  if (!next) {
    return (
      <EmptyState
        icon={CalendarClock}
        title={format(t('cfg.no-config'), { outlet: outletName })}
        action={
          admin ? (
            <Button
              variant="outline"
              onPress={() => router.push('/attendance/configs')}
            >
              <SlidersHorizontal className="text-foreground size-[18px]" />
              <Text>{t('modules.configs')}</Text>
            </Button>
          ) : undefined
        }
      />
    );
  }

  const days = daysUntil(next.opensAt);
  const day =
    days === 0
      ? t('att.today')
      : days === 1
        ? t('att.tomorrow')
        : t(
            `wd-full.${next.opensAt.getDay() === 0 ? 7 : next.opensAt.getDay()}` as MessageKey,
          );
  return (
    <EmptyState
      icon={ClipboardCheck}
      title={t('att.no-session')}
      body={format(t('att.next-is'), {
        name: next.config.name,
        time: formatClock(
          `${String(next.opensAt.getHours()).padStart(2, '0')}:${String(next.opensAt.getMinutes()).padStart(2, '0')}`,
        ),
        day,
      })}
    />
  );
}
