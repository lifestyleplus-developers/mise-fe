import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import {
  ChecklistCard,
  ChecklistCardSkeleton,
} from '@/features/checklists/checklist-card';
import {
  useChecklistNotice,
  useChecklistNoticeText,
} from '@/features/checklists/checklist-notice';
import { useScheduleText } from '@/features/checklists/schedule-text';
import { useChecklists } from '@/features/checklists/use-checklists';
import { isForbidden } from '@/features/outlets/outlet-errors';
import { useOutlets } from '@/features/outlets/use-outlets';
import { PushedScreen } from '@/features/shell/pushed-screen';
import type { ChecklistListItem } from '@/shared/api/types';
import { AutoDismissBanner } from '@/shared/components/auto-dismiss-banner';
import { EmptyState } from '@/shared/components/empty-state';
import { NewButton } from '@/shared/components/new-button';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { Banner } from '@/shared/components/ui/banner';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type Show = 'active' | 'archived';

/** CHK-10: every checklist in the business, for ADMIN and OWNER. */
export function ChecklistsAdminScreen() {
  const t = useT();
  const router = useRouter();
  const scheduleText = useScheduleText();
  const [show, setShow] = React.useState<Show>('active');
  const archivedView = show === 'archived';
  // Each filter is its own request: the server does the filtering.
  const query = useChecklists({ archivedOnly: archivedView });
  const outlets = useOutlets();
  const pull = usePullToRefresh(query.refetch);
  const noticeText = useChecklistNoticeText();
  const clearNotice = useChecklistNotice((state) => state.clearNotice);

  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  const forbidden = isError && isForbidden(query.error);
  // Already in opening-time order from the server, so paging does not reshuffle.
  const visible = query.data?.pages.flatMap((page) => page.results) ?? [];

  // Outlet counts say nothing in a business with one outlet.
  const singleOutlet =
    outlets.data !== undefined &&
    outlets.data.filter((outlet) => !outlet.is_archived).length <= 1;

  /** "3 tasks · runs at 2 outlets"; left off when the API sent no counts. */
  function countsNote(checklist: ChecklistListItem): string | undefined {
    const { task_count: tasks, outlet_count: runsAt } = checklist;
    if (tasks === undefined) return undefined;
    const taskText =
      tasks === 0
        ? t('chk-list.no-tasks')
        : tasks === 1
          ? t('chk-list.task-one')
          : format(t('chk-list.task-many'), { n: String(tasks) });
    if (archivedView || singleOutlet || tasks === 0 || runsAt === undefined) {
      return taskText;
    }
    const outletText =
      runsAt === 0
        ? t('chk-list.nowhere')
        : runsAt === 1
          ? t('chk-list.runs-one')
          : format(t('chk-list.runs-many'), { n: String(runsAt) });
    return `${taskText} · ${outletText}`;
  }

  function open(checklist: ChecklistListItem) {
    clearNotice();
    router.push({
      pathname: '/checklists/[id]',
      params: { id: checklist.id, name: checklist.name },
    });
  }

  function create() {
    clearNotice();
    router.push('/checklists/new');
  }

  const failedWithNothing = isError && !query.data;
  const loading = query.isPending && !isError;

  let body: React.ReactNode;
  if (loading) {
    body = <ChecklistCardSkeleton count={4} />;
  } else if (failedWithNothing) {
    // Nothing to show and nothing to claim: the banner and Retry are all there is.
    body = null;
  } else if (visible.length === 0) {
    body = archivedView ? (
      <Text className="mx-4 mt-6 text-center text-[15px]">
        {t('chk-list.archived-empty')}
      </Text>
    ) : (
      <EmptyState
        icon={ClipboardList}
        title={t('chk-list.empty-title')}
        body={t('chk-list.empty-body')}
      />
    );
  } else {
    body = (
      <>
        {visible.map((checklist) => (
          <ChecklistCard
            key={checklist.id}
            name={checklist.name}
            schedule={scheduleText(checklist)}
            outlets={[]}
            note={countsNote(checklist)}
            archived={archivedView}
            onOpen={() => open(checklist)}
            openLabel={format(
              t(archivedView ? 'chk-list.open-archived' : 'chk-list.open'),
              { name: checklist.name },
            )}
          />
        ))}
        {isFetchingNextPage ? <ChecklistCardSkeleton count={1} /> : null}
      </>
    );
  }

  return (
    <PushedScreen
      title={t('more.checklists')}
      adminOnly
      backHref="/more"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      action={
        !archivedView && !forbidden ? <NewButton onPress={create} /> : undefined
      }
    >
      {forbidden ? (
        <View className="mx-4">
          <Banner tone="error" message={t('admin.no-access')} />
        </View>
      ) : (
        <>
          {isError ? (
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void query.refetch()}
              retrying={query.isRefetching}
            />
          ) : null}
          {noticeText && !isError ? (
            <View className="mx-4 mb-3">
              <AutoDismissBanner
                tone="notice"
                message={noticeText}
                duration={6000}
                onDismiss={clearNotice}
              />
            </View>
          ) : null}

          {failedWithNothing ? null : (
            <View className="mx-4 mb-3">
              <SegmentedControl
                label={t('chk-list.show')}
                value={show}
                options={[
                  { value: 'active', label: t('chk-list.active') },
                  { value: 'archived', label: t('chk-list.archived') },
                ]}
                onChange={(next) => {
                  clearNotice();
                  setShow(next);
                }}
              />
            </View>
          )}

          {body}
        </>
      )}
    </PushedScreen>
  );
}
