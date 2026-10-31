import { MarkRow, type MarkQueueState } from '@/features/attendance/mark-row';
import { NoteSheet } from '@/features/attendance/note-sheet';
import { useAttendanceSession } from '@/features/attendance/use-attendance-sessions';
import {
  useMarkPerson,
  useMarkQueue,
} from '@/features/attendance/use-mark-person';
import { useAttendanceOutlets } from '@/features/attendance/use-attendance-outlets';
import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { PendingPill } from '@/shared/components/pending-pill';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SearchField } from '@/shared/components/search-field';
import { SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { ApiError } from '@/shared/api/client';
import { format, useT } from '@/shared/i18n';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { useNow } from '@/shared/lib/use-now';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { CheckCheck, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

/** How many rows are drawn at first, and added by each "Show more". */
const PAGE = 25;

type MarkingSessionProps = {
  sessionId: number;
  /** Sits opposite Back: the way to the list of open sessions, when there are several. */
  action?: React.ReactNode;
};

/** One session's roster, marked as it is given: the heart of attendance. */
export function MarkingSession({ sessionId, action }: MarkingSessionProps) {
  const t = useT();
  const router = useRouter();
  const formatClock = useFormatClock();
  const { data: me } = useMe();
  const query = useAttendanceSession(sessionId);
  const outlets = useAttendanceOutlets();
  const queue = useMarkQueue(sessionId);
  const markPerson = useMarkPerson();
  const now = useNow(15_000);
  const pull = usePullToRefresh(query.refetch);
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const [search, setSearch] = React.useState('');
  const [shown, setShown] = React.useState(PAGE);
  const [notingId, setNotingId] = React.useState<number | null>(null);
  const [markingRest, setMarkingRest] = React.useState(false);

  const session = query.data;
  const closeMs = session ? new Date(session.window_close).getTime() : 0;
  const closed = session
    ? session.status === 'FINALIZED' || now >= closeMs
    : false;

  // The window closed under us: ask again, so anyone nobody marked reads "Not marked".
  const refetchOnClose = React.useRef(false);
  React.useEffect(() => {
    if (closed && session?.status === 'OPEN' && !refetchOnClose.current) {
      refetchOnClose.current = true;
      void query.refetch();
    }
  }, [closed, session?.status, query]);

  const refused = [...queue.values()].filter((w) => w.kind === 'refused');
  const roleLost = refused.some((w) => w.error?.status === 403);
  const sessionGone =
    (query.isError &&
      query.error instanceof ApiError &&
      query.error.status === 404) ||
    refused.some((w) => w.error?.status === 404);
  const canMark = Boolean(
    session && me?.memberships.attendance_configs.includes(session.config_id),
  );
  const editable = canMark && !closed && !roleLost;

  // The module went off, or the session is gone: back to Modules with a word.
  React.useEffect(() => {
    if (!sessionGone) return;
    setModulesNotice(
      format(t('modules.attendance-off'), {
        outlet: session?.outlet_name ?? me?.business.name ?? '',
      }),
    );
    router.replace('/modules');
  }, [
    sessionGone,
    session?.outlet_name,
    me?.business.name,
    router,
    setModulesNotice,
    t,
  ]);

  const marks = session?.marks ?? [];
  const needle = search.trim().toLowerCase();
  const matching = marks.filter(
    (mark) =>
      !needle ||
      mark.staff.full_name.toLowerCase().includes(needle) ||
      (mark.staff.staff_code ?? '').toLowerCase().includes(needle),
  );
  const unmarked = marks.filter(
    (mark) => mark.status === 'UNMARKED' && !queue.has(mark.id),
  );

  const nameById = new Map<number, string>();
  for (const mark of marks) {
    if (mark.marked_by) {
      nameById.set(mark.marked_by.id, mark.marked_by.full_name);
    }
  }
  if (me) nameById.set(me.user.id, me.user.full_name);
  const names = (id: number) => nameById.get(id);

  function queueState(markId: number): MarkQueueState | undefined {
    const write = queue.get(markId);
    return write
      ? { kind: write.kind, code: write.error?.body.error.code ?? null }
      : undefined;
  }

  function markRestPresent() {
    setMarkingRest(false);
    for (const mark of unmarked) {
      markPerson.mutate({
        sessionId,
        markId: mark.id,
        request: { status: 'PRESENT' },
      });
    }
  }

  const noting =
    notingId === null ? undefined : marks.find((m) => m.id === notingId);
  const closedAt = session ? formatClock(isoToClock(session.window_close)) : '';
  const waiting = [...queue.values()].filter(
    (w) => w.kind === 'waiting',
  ).length;
  const multiOutlet = outlets.outlets.length > 1;

  let body: React.ReactNode;
  if (!session) {
    body = query.isError ? null : <SkeletonRows count={7} avatar />;
  } else if (marks.length === 0) {
    body = <EmptyState icon={Users} title={t('att.no-roster')} />;
  } else {
    body = (
      <>
        <View className="mx-4 mb-3">
          <SearchField
            value={search}
            onChange={(value) => {
              setSearch(value);
              setShown(PAGE);
            }}
            placeholder={t('att.search-ph')}
            clearLabel={t('att.clear')}
          />
        </View>
        {matching.length === 0 ? (
          <Text className="mx-5 text-[15px] leading-snug">
            {format(t('att.no-match-session'), { q: search.trim() })}
          </Text>
        ) : (
          <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
            {matching.slice(0, shown).map((mark) => (
              <MarkRow
                key={mark.id}
                mark={mark}
                mode={editable ? 'edit' : 'read'}
                queue={queueState(mark.id)}
                closedAt={closedAt}
                userName={names}
                onMark={(status) =>
                  markPerson.mutate({
                    sessionId,
                    markId: mark.id,
                    request: { status },
                  })
                }
                onNote={() => setNotingId(mark.id)}
                onRetry={() => {
                  const write = queue.get(mark.id);
                  if (write) markPerson.mutate(write.variables);
                }}
              />
            ))}
          </View>
        )}
        {shown < matching.length ? (
          <View className="mx-4 mt-3">
            <Button
              variant="outline"
              className="w-full"
              onPress={() => setShown((count) => count + PAGE)}
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
      title={session?.config_name ?? ''}
      eyebrow={
        multiOutlet && session ? session.outlet_name : t('modules.marking')
      }
      backHref="/modules"
      action={action}
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
    >
      {session ? (
        <View className="mx-5 mb-3">
          <Text className="font-sans-semibold text-[14px] leading-snug">
            {format(t(closed ? 'att.closed-at' : 'att.closes'), {
              time: closedAt,
            })}
          </Text>
          <View className="mt-1 flex-row flex-wrap gap-x-3 gap-y-0.5">
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
            {waiting > 0 ? (
              <Text className="text-[14px]">
                {format(t('att.n-waiting'), { n: String(waiting) })}
              </Text>
            ) : null}
            {closed && session.counts.not_marked > 0 ? (
              <Text className="text-[14px]">
                {format(t('att.n-not-marked'), {
                  n: String(session.counts.not_marked),
                })}
              </Text>
            ) : null}
            {!closed && session.counts.unmarked > 0 ? (
              <Text className="text-[14px]">
                {format(t('att.n-not-marked-yet'), {
                  n: String(session.counts.unmarked),
                })}
              </Text>
            ) : null}
          </View>
          {editable ? (
            <Text className="mt-0.5 text-[13px]">
              {t('att.saved-as-you-go')}
            </Text>
          ) : null}
          {closed ? (
            <Text className="mt-0.5 text-[13px]">
              {format(t('att.closed-record'), { time: closedAt })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {editable && unmarked.length > 0 && !needle && marks.length > 0 ? (
        <View className="mx-4 mb-3">
          <Button
            variant="outline"
            className="w-full"
            onPress={() => setMarkingRest(true)}
          >
            <CheckCheck className="text-foreground size-[18px]" />
            <Text>{t('att.mark-rest')}</Text>
          </Button>
        </View>
      ) : null}

      {query.isError && !sessionGone ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : null}
      {waiting > 0 && !closed ? (
        <View className="mx-4 mb-3">
          <PendingPill
            label={format(t('att.n-waiting'), { n: String(waiting) })}
          />
        </View>
      ) : null}
      {roleLost ? (
        <View className="mx-4 mb-3">
          <Banner tone="error" message={t('att.mark-forbidden')} />
        </View>
      ) : null}
      {session && !canMark && !roleLost ? (
        <View className="mx-4 mb-3">
          <Banner tone="notice" message={t('att.view-only')} />
        </View>
      ) : null}

      {body}

      {noting && editable ? (
        <NoteSheet
          key={noting.id}
          mark={noting}
          onClose={() => setNotingId(null)}
          onSave={(note) => {
            if (
              noting.status === 'PRESENT' ||
              noting.status === 'NOT_PRESENT'
            ) {
              markPerson.mutate({
                sessionId,
                markId: noting.id,
                request: { status: noting.status, note },
              });
            }
            setNotingId(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        visible={markingRest}
        icon={CheckCheck}
        title={format(t('att.mark-rest-title'), { n: String(unmarked.length) })}
        body={format(t('att.mark-rest-body'), { time: closedAt })}
        safe={{
          label: t('admin.cancel'),
          onPress: () => setMarkingRest(false),
        }}
        other={{ label: t('att.mark-present'), onPress: markRestPresent }}
      />
    </PushedScreen>
  );
}
