import { useAttendanceOutlets } from '@/features/attendance/use-attendance-outlets';
import { classifyStaffError } from '@/features/attendance/staff-errors';
import {
  AddStaffSheet,
  EditStaffSheet,
} from '@/features/attendance/staff-sheets';
import { useRoster, type RosterPerson } from '@/features/attendance/use-roster';
import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { Avatar } from '@/shared/components/avatar';
import { AutoDismissBanner } from '@/shared/components/auto-dismiss-banner';
import { EmptyState } from '@/shared/components/empty-state';
import {
  OutletPicker,
  useSelectedOutlet,
} from '@/shared/components/outlet-picker';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SearchField } from '@/shared/components/search-field';
import { Skeleton, SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { cn } from '@/shared/lib/utils';
import { useRouter } from 'expo-router';
import {
  Archive,
  CircleCheck,
  Plus,
  UserMinus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

const STATUS: Record<
  RosterPerson['status'],
  { label: MessageKey; Icon: LucideIcon }
> = {
  active: { label: 'att.active', Icon: CircleCheck },
  inactive: { label: 'att.not-active-here', Icon: UserMinus },
  archived: { label: 'att.archived', Icon: Archive },
};

/** Staff roster (ATT-03): the people who need attendance recorded, by outlet. */
export function RosterScreen() {
  const t = useT();
  const router = useRouter();
  const { data: me, refetch: refetchMe } = useMe();
  const attendanceOutlets = useAttendanceOutlets();
  const [outlet, setOutletId] = useSelectedOutlet(attendanceOutlets.outlets);
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const [search, setSearch] = React.useState('');
  const [showDeactivated, setShowDeactivated] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<RosterPerson | null>(null);
  const [saved, setSaved] = React.useState<{ id: number; text: string } | null>(
    null,
  );

  const { people, query, loadingAll } = useRoster({
    outletId: outlet?.id,
    search: useDebouncedValue(search.trim()),
    showDeactivated,
    showArchived,
  });
  const pull = usePullToRefresh(() => {
    query.refetch();
    attendanceOutlets.refetch();
  });

  const admin = me ? canAdminister(me.user.tenant_role) : false;
  const failure = query.isError ? classifyStaffError(query.error) : null;
  const outletName = outlet?.name ?? me?.business.name ?? '';

  // Attendance switched off under us: back to Modules, with a word about it.
  const moduleOff =
    failure === 'module-off' ||
    (!attendanceOutlets.isPending &&
      !attendanceOutlets.isError &&
      attendanceOutlets.outlets.length === 0);
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.attendance-off'), { outlet: outletName }),
    );
    router.replace('/modules');
  }, [moduleOff, outletName, router, setModulesNotice, t]);

  const forbidden = failure === 'forbidden';
  const searching = search.trim().length > 0;
  const loading =
    attendanceOutlets.isPending || (query.isPending && outlet !== undefined);

  // After a refusal, ask again: if the list is refused too, the role has gone.
  function refreshAccess() {
    void query.refetch();
    void refetchMe();
  }

  function notify(text: string) {
    setSaved({ id: Date.now(), text });
  }

  function loadMore() {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }

  const body = (() => {
    if (forbidden) {
      return (
        <View className="mx-4">
          <Banner tone="error" message={t('att.forbidden')} />
        </View>
      );
    }
    if (loading) return <SkeletonRows count={6} avatar />;
    if (query.isError || attendanceOutlets.isError) {
      return null; // The Retry banner above says so.
    }
    if (people.length === 0 && !loadingAll) {
      return searching ? (
        <Text className="mx-5 text-[15px] leading-snug">
          {format(t('att.no-match-staff'), {
            q: search.trim(),
            outlet: outletName,
          })}
        </Text>
      ) : (
        <EmptyState
          icon={Users}
          title={format(t('att.empty-roster'), { outlet: outletName })}
          body={t('att.empty-roster-body')}
        />
      );
    }
    return (
      <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
        {people.map((person, index) => (
          <RosterRow
            key={person.id}
            person={person}
            first={index === 0}
            // Archived people are history.
            onPress={
              person.status === 'archived'
                ? undefined
                : () => {
                    setSaved(null);
                    setEditing(person);
                  }
            }
          />
        ))}
        {query.isFetchingNextPage || loadingAll
          ? [0, 1].map((key) => (
              <View
                key={key}
                className="border-border min-h-14 flex-row items-center gap-3 border-t px-4 py-2"
              >
                <Skeleton className="size-10" />
                <View className="flex-1 gap-2">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </View>
              </View>
            ))
          : null}
      </View>
    );
  })();

  return (
    <PushedScreen
      title={t('modules.roster')}
      backHref="/modules"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
      onEndReached={showDeactivated ? undefined : loadMore}
      footer={
        !outlet || forbidden ? undefined : (
          <Button className="w-full" onPress={() => setAdding(true)}>
            <Plus className="text-primary-foreground size-5" />
            <Text>{t('att.add-staff')}</Text>
          </Button>
        )
      }
    >
      {forbidden ? null : (
        <>
          <View className="mx-4 mb-3 gap-3">
            <OutletPicker
              outlets={attendanceOutlets.outlets}
              value={outlet?.id ?? 0}
              onChange={(id) => {
                setOutletId(id);
                setSaved(null);
              }}
            />
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={t('att.search-ph')}
              clearLabel={t('att.clear')}
            />
            <View className="flex-row flex-wrap gap-2">
              <ToggleChip
                label={t('att.show-deactivated')}
                on={showDeactivated}
                onPress={() => setShowDeactivated((value) => !value)}
              />
              <ToggleChip
                label={t('att.show-archived')}
                on={showArchived}
                onPress={() => setShowArchived((value) => !value)}
              />
            </View>
          </View>

          {query.isError || attendanceOutlets.isError ? (
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => {
                void query.refetch();
                attendanceOutlets.refetch();
              }}
              retrying={query.isRefetching || attendanceOutlets.isRefetching}
            />
          ) : null}
          {saved ? (
            <View className="mx-4 mb-3">
              <AutoDismissBanner
                key={saved.id}
                tone="notice"
                message={saved.text}
                onDismiss={() => setSaved(null)}
              />
            </View>
          ) : null}
        </>
      )}

      {body}

      {outlet ? (
        <AddStaffSheet
          visible={adding}
          outletId={outlet.id}
          outlets={attendanceOutlets.outlets}
          onClose={() => setAdding(false)}
          onSaved={notify}
          onForbidden={refreshAccess}
          onModuleOff={() => void query.refetch()}
        />
      ) : null}
      {editing ? (
        <EditStaffSheet
          key={editing.id}
          person={editing}
          outlets={attendanceOutlets.outlets}
          canArchive={admin}
          onClose={() => setEditing(null)}
          onSaved={notify}
          onForbidden={refreshAccess}
          onModuleOff={() => void query.refetch()}
        />
      ) : null}
    </PushedScreen>
  );
}

function RosterRow({
  person,
  first,
  onPress,
}: {
  person: RosterPerson;
  first: boolean;
  onPress?: () => void;
}) {
  const t = useT();
  const { label, Icon } = STATUS[person.status];
  const content = (
    <>
      <Avatar name={person.full_name} />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-[15px] leading-snug">
          {person.full_name}
        </Text>
        {person.staff_code ? (
          <Text className="text-muted-foreground text-[13px]">
            {person.staff_code}
          </Text>
        ) : null}
      </View>
      <View className="shrink-0 flex-row items-center gap-1.5">
        <Icon
          className={cn(
            'size-4 shrink-0',
            person.status === 'active'
              ? 'text-foreground'
              : 'text-muted-foreground',
          )}
        />
        <Text
          className={cn(
            'font-sans-semibold text-[13px]',
            person.status !== 'active' && 'text-muted-foreground',
          )}
        >
          {t(label)}
        </Text>
      </View>
    </>
  );
  const frame = cn(
    'min-h-14 flex-row items-center gap-3 px-4 py-2',
    !first && 'border-border border-t',
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cn(frame, 'active:bg-accent')}
    >
      {content}
    </Pressable>
  ) : (
    <View className={frame}>{content}</View>
  );
}

function ToggleChip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      className={cn(
        'min-h-11 justify-center rounded-full border px-4',
        on ? 'border-primary bg-primary' : 'border-input-edge bg-card',
      )}
    >
      <Text
        className={cn(
          'font-sans-semibold text-[14px]',
          on && 'text-primary-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
