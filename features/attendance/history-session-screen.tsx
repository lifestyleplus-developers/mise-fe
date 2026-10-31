import { MarkRow } from '@/features/attendance/mark-row';
import { useAttendanceOutlets } from '@/features/attendance/use-attendance-outlets';
import { useAttendanceSession } from '@/features/attendance/use-attendance-sessions';
import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { AttendanceMark } from '@/shared/api/types';
import { EmptyState } from '@/shared/components/empty-state';
import { FilterChips } from '@/shared/components/filter-chips';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SearchField } from '@/shared/components/search-field';
import { SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { formatDayWithWeekday } from '@/shared/lib/date-range';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type Filter = 'all' | 'present' | 'notPresent' | 'notMarked';

/** Which filter a mark falls under: a manager saying absent is told apart from nobody checking. */
function filterOf(mark: AttendanceMark): Exclude<Filter, 'all'> | null {
  if (mark.status === 'PRESENT') return 'present';
  if (mark.status === 'NOT_PRESENT') {
    return mark.source === 'SYSTEM' ? 'notMarked' : 'notPresent';
  }
  return null;
}

/** One past session (ATT-02): counts, search, a status filter, and every correction. */
export function HistorySessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);
  const formatClock = useFormatClock();
  const { data: me } = useMe();
  const outlets = useAttendanceOutlets();
  const query = useAttendanceSession(Number(id));
  const pull = usePullToRefresh(query.refetch);
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');

  const session = query.data;
  const status = query.error instanceof ApiError ? query.error.status : null;
  const forbidden = status === 403;
  const gone = status === 404;
  React.useEffect(() => {
    if (!gone) return;
    setModulesNotice(
      format(t('modules.attendance-off'), { outlet: me?.business.name ?? '' }),
    );
    router.replace('/modules');
  }, [gone, me?.business.name, router, setModulesNotice, t]);

  const marks = session?.marks ?? [];
  const needle = search.trim().toLowerCase();
  const shown = marks.filter(
    (mark) =>
      (filter === 'all' || filterOf(mark) === filter) &&
      (!needle ||
        mark.staff.full_name.toLowerCase().includes(needle) ||
        (mark.staff.staff_code ?? '').toLowerCase().includes(needle)),
  );

  const nameById = new Map<number, string>();
  for (const mark of marks) {
    if (mark.marked_by) {
      nameById.set(mark.marked_by.id, mark.marked_by.full_name);
    }
  }

  const closedAt = session ? formatClock(isoToClock(session.window_close)) : '';
  const multiOutlet = outlets.outlets.length > 1;

  let body: React.ReactNode;
  if (forbidden) {
    body = (
      <View className="mx-4 gap-3">
        <Banner tone="error" message={t('att.forbidden')} />
        <Button
          variant="outline"
          className="self-start"
          onPress={() => router.replace('/attendance/history')}
        >
          <Text>{t('common.back')}</Text>
        </Button>
      </View>
    );
  } else if (!session) {
    body = query.isError ? null : <SkeletonRows count={7} avatar />;
  } else {
    body = (
      <>
        <View className="mx-5 mb-3">
          <Text className="font-sans-semibold text-[14px] leading-snug">
            {`${formatClock(isoToClock(session.window_open))} – ${closedAt}`}
          </Text>
          {session.status === 'FINALIZED' ? (
            <Text className="mt-0.5 text-[14px] leading-snug">
              {format(t('att.closed-record'), { time: closedAt })}
            </Text>
          ) : null}
          <View className="mt-1 flex-row flex-wrap gap-x-3">
            <Text className="font-sans-semibold text-[14px]">
              {format(t('att.n-present'), {
                n: String(session.counts.present),
              })}
            </Text>
            {session.counts.not_present > 0 ? (
              <Text className="text-[14px]">
                {format(t('att.n-not-present'), {
                  n: String(session.counts.not_present),
                })}
              </Text>
            ) : null}
            {session.counts.not_marked > 0 ? (
              <Text className="text-[14px]">
                {format(t('att.n-not-marked'), {
                  n: String(session.counts.not_marked),
                })}
              </Text>
            ) : null}
          </View>
        </View>

        {marks.length === 0 ? (
          <EmptyState icon={Users} title={t('att.no-roster')} />
        ) : (
          <>
            <View className="mx-4 mb-3 gap-3">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={t('att.search-ph')}
                clearLabel={t('att.clear')}
              />
              <FilterChips
                label={t('modules.history')}
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: t('att.all') },
                  { value: 'present', label: t('att.present') },
                  { value: 'notPresent', label: t('att.not-present') },
                  { value: 'notMarked', label: t('att.not-marked') },
                ]}
              />
            </View>
            {shown.length === 0 ? (
              <Text className="mx-5 text-[15px] leading-snug">
                {search.trim()
                  ? format(t('att.no-match-session'), { q: search.trim() })
                  : t('att.no-match-filter')}
              </Text>
            ) : (
              <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
                {shown.map((mark) => (
                  <MarkRow
                    key={mark.id}
                    mark={mark}
                    mode="read"
                    userName={(userId) => nameById.get(userId)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <PushedScreen
      title={
        session
          ? `${session.config_name} · ${formatDayWithWeekday(session.window_open, language)}`
          : ''
      }
      eyebrow={
        multiOutlet && session ? session.outlet_name : t('modules.history')
      }
      backHref="/attendance/history"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
    >
      {query.isError && !forbidden && !gone ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : null}
      {body}
    </PushedScreen>
  );
}
