import { attendanceSessionHref } from '@/features/attendance/links';
import { useAttendanceOutlets } from '@/features/attendance/use-attendance-outlets';
import {
  useAttendanceSessions,
  useOpenSessions,
} from '@/features/attendance/use-attendance-sessions';
import { FilterChip } from '@/features/home/filter-chip';
import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { AttendanceSession } from '@/shared/api/types';
import {
  DateRangeSheet,
  useRangeLabel,
} from '@/shared/components/date-range-sheet';
import { EmptyState } from '@/shared/components/empty-state';
import { OptionList } from '@/shared/components/option-list';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import {
  formatDay,
  formatDayWithWeekday,
  rangeFor,
  toDay,
  type DateRange,
} from '@/shared/lib/date-range';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useRouter } from 'expo-router';
import { Calendar, CalendarSearch, ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

const ALL = 'all';

/** Session history (ATT-02): open now, then past sessions with who was there. */
export function HistoryScreen() {
  const t = useT();
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);
  const { data: me } = useMe();
  const outlets = useAttendanceOutlets();
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const [range, setRange] = React.useState<DateRange>(() => rangeFor('last7'));
  const [outletId, setOutletId] = React.useState<number | undefined>();
  const [sheet, setSheet] = React.useState<'range' | 'outlet' | null>(null);
  const rangeLabel = useRangeLabel();

  const past = useAttendanceSessions({
    outletId,
    state: 'closed',
    from: range.from,
    to: range.to,
  });
  const open = useOpenSessions(outletId);
  const pull = usePullToRefresh(() => {
    void past.refetch();
    void open.refetch();
  });

  const error = past.error ?? open.error;
  const status = error instanceof ApiError ? error.status : null;
  const forbidden = status === 403;
  const moduleOff =
    status === 404 ||
    (!outlets.isPending &&
      !outlets.isError &&
      outlets.outlets.length === 0 &&
      past.isSuccess);
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.attendance-off'), { outlet: me?.business.name ?? '' }),
    );
    router.replace('/modules');
  }, [moduleOff, me?.business.name, router, setModulesNotice, t]);

  const sessions = past.data?.pages.flatMap((page) => page.results) ?? [];
  // Open sessions are shown by the day they opened, within the chosen range.
  const openNow = (open.data ?? []).filter((session) => {
    const day = toDay(new Date(session.window_open));
    return day >= range.from && day <= range.to;
  });
  const showOutletChip = outlets.outlets.length > 1;
  const outletName = outlets.outlets.find((o) => o.id === outletId)?.name;
  const loading = past.isPending || open.isPending;
  const failed = (past.isError || open.isError) && !forbidden && !moduleOff;

  let body: React.ReactNode;
  if (forbidden) {
    body = (
      <View className="mx-4 gap-3">
        <Banner tone="error" message={t('att.forbidden')} />
        <Button
          variant="outline"
          className="self-start"
          onPress={() => router.replace('/modules')}
        >
          <Text>{t('common.back')}</Text>
        </Button>
      </View>
    );
  } else if (loading) {
    body = failed ? null : <CardSkeletons />;
  } else if (sessions.length === 0 && openNow.length === 0) {
    body = (
      <EmptyState
        icon={CalendarSearch}
        title={format(t('att.empty-range'), {
          a: formatDay(range.from, language),
          b: formatDay(range.to, language),
        })}
        action={
          range.preset === 'last30' ? undefined : (
            <Button
              variant="outline"
              onPress={() => setRange(rangeFor('last30'))}
            >
              <Calendar className="text-foreground size-[18px]" />
              <Text>{t('range.last-30')}</Text>
            </Button>
          )
        }
      />
    );
  } else {
    body = (
      <>
        {openNow.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            open
            showOutlet={showOutletChip}
            onPress={() => router.push(attendanceSessionHref(session.id))}
          />
        ))}
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            showOutlet={showOutletChip}
            onPress={() =>
              router.push({
                pathname: '/attendance/history/[id]',
                params: { id: session.id },
              })
            }
          />
        ))}
        {past.hasNextPage ? (
          <View className="mx-4 mt-1">
            <Button
              variant="outline"
              className="w-full"
              disabled={past.isFetchingNextPage}
              onPress={() => void past.fetchNextPage()}
            >
              <Text>{t('att.load-more')}</Text>
            </Button>
          </View>
        ) : null}
      </>
    );
  }

  return (
    <PushedScreen
      title={t('modules.history')}
      eyebrow={t('modules.attendance')}
      backHref="/modules"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
    >
      {forbidden ? null : (
        <View className="mx-4 mb-3 flex-row flex-wrap gap-2">
          {showOutletChip ? (
            <FilterChip
              label={t('home.all-outlets')}
              value={outletName}
              clearLabel={t('home.clear-filter')}
              onOpen={() => setSheet('outlet')}
              onClear={() => setOutletId(undefined)}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={format(t('range.chip'), {
              range: rangeLabel(range),
            })}
            onPress={() => setSheet('range')}
            className="border-input-edge bg-card active:bg-accent min-h-11 max-w-full shrink flex-row items-center gap-1 rounded-full border px-3.5"
          >
            <Text
              numberOfLines={1}
              className="font-sans-semibold shrink text-[13px]"
            >
              {rangeLabel(range)}
            </Text>
            <ChevronDown className="text-foreground size-4 shrink-0" />
          </Pressable>
        </View>
      )}

      {failed ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void past.refetch();
            void open.refetch();
          }}
          retrying={past.isRefetching || open.isRefetching}
        />
      ) : null}

      <View className="gap-3">{body}</View>

      <DateRangeSheet
        visible={sheet === 'range'}
        value={range}
        presets={['last7', 'last30']}
        onChange={setRange}
        onClose={() => setSheet(null)}
      />
      <BottomSheet
        visible={sheet === 'outlet'}
        title={t('home.outlet-sheet')}
        onDismiss={() => setSheet(null)}
        footer={
          <Button
            variant="outline"
            className="w-full"
            onPress={() => setSheet(null)}
          >
            <Text>{t('admin.cancel')}</Text>
          </Button>
        }
      >
        <OptionList
          value={outletId === undefined ? ALL : String(outletId)}
          options={[
            { value: ALL, label: t('home.all-outlets') },
            ...outlets.outlets.map((o) => ({
              value: String(o.id),
              label: o.name,
            })),
          ]}
          onChange={(value) => {
            setOutletId(value === ALL ? undefined : Number(value));
            setSheet(null);
          }}
        />
      </BottomSheet>
    </PushedScreen>
  );
}

function CardSkeletons() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="gap-3"
    >
      {[0, 1, 2, 3].map((key) => (
        <View
          key={key}
          className="shadow-card border-border bg-card mx-4 gap-2 rounded-3xl border px-4 py-3"
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </View>
      ))}
    </View>
  );
}

/** One session: its name, when, and how many were there. */
function SessionCard({
  session,
  open = false,
  showOutlet,
  onPress,
}: {
  session: AttendanceSession;
  open?: boolean;
  showOutlet: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const formatClock = useFormatClock();
  const { counts } = session;
  const title = [
    session.config_name,
    showOutlet ? session.outlet_name : null,
    open ? t('att.open-now') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const hours = `${formatClock(isoToClock(session.window_open))} – ${formatClock(isoToClock(session.window_close))}`;
  const nobodyThere = counts.present === 0 && counts.not_present === 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="shadow-card border-border bg-card active:bg-accent mx-4 min-h-16 rounded-3xl border px-4 py-3"
    >
      <Text className="font-sans-semibold text-[16px] leading-snug">
        {title}
      </Text>
      <Text className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
        {open
          ? format(t('att.closes'), {
              time: formatClock(isoToClock(session.window_close)),
            })
          : `${formatDayWithWeekday(session.window_open, language)} · ${hours}`}
      </Text>
      <View className="mt-1.5 flex-row flex-wrap gap-x-3">
        {nobodyThere && !open ? (
          <Text className="font-sans-semibold text-[13px]">
            {format(t('att.zero-present'), { n: String(counts.not_marked) })}
          </Text>
        ) : (
          <>
            <Text className="font-sans-semibold text-[13px]">
              {format(t('att.n-present'), { n: String(counts.present) })}
            </Text>
            {counts.not_present > 0 ? (
              <Text className="text-[13px]">
                {format(t('att.n-not-present'), {
                  n: String(counts.not_present),
                })}
              </Text>
            ) : null}
            {counts.not_marked > 0 ? (
              <Text className="text-muted-foreground text-[13px]">
                {format(t('att.n-not-marked'), {
                  n: String(counts.not_marked),
                })}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  );
}
