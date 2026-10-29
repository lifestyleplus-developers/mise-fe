import { useMe } from '@/features/auth/use-me';
import {
  LOCKING_FAILURES,
  classifyTeamError,
  type TeamFailure,
} from '@/features/assignments/team-errors';
import { TeamPicker } from '@/features/assignments/team-picker';
import { useStopRunning } from '@/features/assignments/use-assignments';
import {
  useMembers,
  usePastMembers,
  useRemoveMember,
} from '@/features/assignments/use-members';
import { useOutlets } from '@/features/outlets/use-outlets';
import { PushedScreen } from '@/features/shell/pushed-screen';
import type { AssignmentMember, AssignmentRole } from '@/shared/api/types';
import { Avatar } from '@/shared/components/avatar';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { format, useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Store, UserX, Users } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

/**
 * CHK-08: who is on one checklist at one outlet. An ADMIN or OWNER changes both
 * lists; a Checklist Manager changes Team Members only. A CL_ADMIN reaches this
 * screen, so it is not admin-only; the platform decides what each caller may do.
 */
export function AssignmentMembersScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    checklist?: string;
    outlet?: string;
    /** User ids (comma-separated) who came back when this outlet was started again. */
    returning?: string;
  }>();
  const assignmentId = Number(params.id);
  // Both are authored content, shown exactly as typed.
  const checklistName = params.checklist ?? '';
  const outletName = params.outlet ?? '';
  // Told once, by the screen that started the outlet; gone when this screen is left.
  const returning = new Set(
    (params.returning ?? '').split(',').filter(Boolean).map(Number),
  );

  const { data: me } = useMe();
  const outlets = useOutlets();
  const members = useMembers(assignmentId);
  const remove = useRemoveMember(assignmentId);
  const stopRunning = useStopRunning(assignmentId);

  const viewerIsAdmin = me ? canAdminister(me.user.tenant_role) : false;
  const supervises =
    me?.memberships.cl_admin_assignments.includes(assignmentId) ?? false;

  const [picker, setPicker] = React.useState<AssignmentRole | null>(null);
  const [removing, setRemoving] = React.useState<AssignmentMember | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<TeamFailure | null>(null);
  const [confirmStop, setConfirmStop] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);
  const [pastOpen, setPastOpen] = React.useState(false);
  const past = usePastMembers(assignmentId, { enabled: pastOpen });

  // Someone reached this by a link while on neither bucket.
  const notOnIt = me !== undefined && !viewerIsAdmin && !supervises;
  const lockedBy: TeamFailure | null = notOnIt
    ? 'notYours'
    : failure && LOCKING_FAILURES.includes(failure)
      ? failure
      : members.isError
        ? (() => {
            const kind = classifyTeamError(members.error, {
              role: 'CL_IMP',
              viewerIsAdmin,
            });
            return LOCKING_FAILURES.includes(kind) ? kind : null;
          })()
        : null;
  const locked = lockedBy !== null;

  const liveOutlets = (outlets.data ?? []).filter((o) => !o.is_archived);
  // A one-outlet business shows the checklist's name alone, and can stop it here.
  const singleOutlet = viewerIsAdmin && liveOutlets.length === 1;
  const where =
    singleOutlet || !outletName
      ? checklistName
      : format(t('team.at'), { name: checklistName, outlet: outletName });

  const all = members.data ?? [];
  const managers = all.filter((m) => m.role === 'CL_ADMIN');
  const team = all.filter((m) => m.role === 'CL_IMP');
  const loading = members.isPending && !members.isError && !locked;
  const loadFailed = members.isError && !members.data && !locked;

  /** The last active person in a bucket: removing them leaves it empty. */
  const isLastOfBucket = (member: AssignmentMember) =>
    all.filter(
      (m) =>
        m.role === member.role && m.is_active && m.user_id !== member.user_id,
    ).length === 0;

  function removeNow(member: AssignmentMember) {
    setRemoving(null);
    setNotice(null);
    setFailure(null);
    remove.mutate(member.user_id, {
      onSuccess: () =>
        setNotice(format(t('team.removed'), { name: member.full_name })),
      onError: (cause) =>
        setFailure(
          classifyTeamError(cause, { role: member.role, viewerIsAdmin }),
        ),
    });
  }

  function failureText(kind: TeamFailure): string {
    switch (kind) {
      case 'notYours':
        return format(t('team.not-yours'), { name: where });
      case 'roleLost':
        return t('team.role-lost');
      case 'gone':
        return t('sched.gone');
      case 'forbiddenManager':
        return t('team.forbidden-manager');
      case 'serverError':
        return t('team.server-error');
      default:
        return t('out.save-failed');
    }
  }

  function openPicker(role: AssignmentRole) {
    setNotice(null);
    setFailure(null);
    setPicker(role);
  }

  const removingLast = removing ? isLastOfBucket(removing) : false;
  const removeBody = removing
    ? [
        format(t('team.remove-body'), { name: removing.full_name }),
        removingLast
          ? format(
              t(
                removing.role === 'CL_IMP'
                  ? 'team.remove-last-member'
                  : 'team.remove-last-manager',
              ),
              { where },
            )
          : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  function section(
    heading: string,
    items: AssignmentMember[],
    empty: string,
    canRemove: boolean,
    add?: { label: string; onPress: () => void },
  ) {
    return (
      <View className="mb-5">
        <Text
          accessibilityRole="header"
          variant="h3"
          className="mx-5 mb-2 text-[17px] leading-tight"
        >
          {heading}
        </Text>
        {items.length === 0 ? (
          <Text className="shadow-card border-border bg-card mx-4 rounded-3xl border px-4 py-4 text-[14px] leading-snug">
            {empty}
          </Text>
        ) : (
          <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
            {items.map((member, index) => (
              <MemberRow
                key={member.user_id}
                member={member}
                first={index === 0}
                spinning={
                  remove.isPending && remove.variables === member.user_id
                }
                note={
                  returning.has(member.user_id)
                    ? t('team.from-before')
                    : undefined
                }
                onRemove={canRemove ? () => setRemoving(member) : undefined}
              />
            ))}
          </View>
        )}
        {add ? (
          <View className="mx-4 mt-3">
            <Button variant="outline" className="w-full" onPress={add.onPress}>
              <Plus className="text-foreground size-4" />
              <Text>{add.label}</Text>
            </Button>
          </View>
        ) : null}
      </View>
    );
  }

  const footer =
    locked || loadFailed || stopped ? undefined : (
      <Button className="w-full" onPress={() => openPicker('CL_IMP')}>
        <Users className="text-primary-foreground size-4" />
        <Text>{t('team.add-member')}</Text>
      </Button>
    );

  return (
    <PushedScreen
      title={checklistName || t('checklists.team')}
      eyebrow={singleOutlet ? undefined : outletName || undefined}
      backHref="/checklists"
      footer={footer}
    >
      <View className="gap-3 pb-3">
        {lockedBy ? (
          <View className="mx-4 gap-2">
            <Banner tone="error" message={failureText(lockedBy)} />
            {lockedBy === 'gone' ? (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/home')
                }
              >
                <Text>{t('common.back')}</Text>
              </Button>
            ) : null}
          </View>
        ) : failure ? (
          <View className="mx-4">
            <Banner tone="error" message={failureText(failure)} />
          </View>
        ) : null}
        {loadFailed ? (
          <RetryBanner
            message={t('common.offline')}
            retryLabel={t('common.retry')}
            onRetry={() => void members.refetch()}
            retrying={members.isRefetching}
          />
        ) : null}
        {notice && !failure && !locked ? (
          <View className="mx-4" accessibilityLiveRegion="polite">
            <Banner tone="notice" message={notice} />
          </View>
        ) : null}
        {stopped ? (
          <View className="mx-4" accessibilityLiveRegion="polite">
            <Banner
              tone="notice"
              message={format(t('team.stopped'), { name: checklistName })}
            />
          </View>
        ) : null}
      </View>

      {loading ? (
        <SkeletonRows count={5} avatar />
      ) : locked || loadFailed || stopped ? null : (
        <>
          {section(
            format(t('team.managers'), { n: String(managers.length) }),
            managers,
            t('team.managers-empty'),
            viewerIsAdmin,
            viewerIsAdmin
              ? {
                  label: t('team.add-manager'),
                  onPress: () => openPicker('CL_ADMIN'),
                }
              : undefined,
          )}
          {section(
            format(t('team.members'), { n: String(team.length) }),
            team,
            t('team.members-empty'),
            true,
          )}
          <View className="mx-4 -mt-3 mb-4">
            <Pressable
              accessibilityRole="button"
              onPress={() => setPastOpen(true)}
              className="active:bg-accent min-h-11 justify-center self-start rounded-full px-1"
            >
              <Text className="font-sans-semibold text-[14px] underline">
                {t('team.past')}
              </Text>
            </Pressable>
          </View>
          {singleOutlet ? (
            <View className="mx-4 mt-3">
              <Button
                variant="outline"
                className="border-destructive/50 w-full"
                onPress={() => setConfirmStop(true)}
              >
                <Store className="text-destructive-soft-foreground size-4" />
                <Text className="text-destructive-soft-foreground">
                  {t('team.stop')}
                </Text>
              </Button>
            </View>
          ) : null}
        </>
      )}

      <BottomSheet
        visible={pastOpen}
        title={t('team.past')}
        onDismiss={() => setPastOpen(false)}
        footer={
          <Button className="w-full" onPress={() => setPastOpen(false)}>
            <Text>{t('team.close')}</Text>
          </Button>
        }
      >
        {past.isPending && !past.isError ? (
          <SkeletonRows count={3} />
        ) : past.isError ? (
          <View className="-mx-4">
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void past.refetch()}
              retrying={past.isRefetching}
            />
          </View>
        ) : (past.data?.length ?? 0) === 0 ? (
          <Text className="px-1 text-[15px] leading-snug">
            {t('team.past-none')}
          </Text>
        ) : (
          <View className="border-border overflow-hidden rounded-2xl border">
            {past.data!.map((member, index) => (
              <Text
                key={`${member.user_id}-${member.removed_at}`}
                className={cn(
                  'px-4 py-3 text-[15px] leading-snug',
                  index > 0 && 'border-border border-t',
                )}
              >
                {format(t('team.past-row'), {
                  name: member.full_name,
                  when: whenText(member.removed_at, t('team.today')),
                  by: member.removed_by?.full_name ?? '',
                })}
              </Text>
            ))}
          </View>
        )}
      </BottomSheet>

      {picker ? (
        <TeamPicker
          assignmentId={assignmentId}
          role={picker}
          title={t(
            picker === 'CL_IMP' ? 'team.add-member' : 'team.add-manager',
          )}
          viewerIsAdmin={viewerIsAdmin}
          onClose={() => setPicker(null)}
          onAdded={(name) => setNotice(format(t('team.added'), { name }))}
          onLocked={setFailure}
        />
      ) : null}
      <ConfirmDialog
        visible={removing !== null}
        icon={UserX}
        tone={removingLast ? 'warning' : 'neutral'}
        title={
          removing
            ? format(t('team.remove-title'), {
                name: removing.full_name,
                where,
              })
            : ''
        }
        body={removeBody}
        safe={{ label: t('admin.cancel'), onPress: () => setRemoving(null) }}
        other={{
          label: t('team.remove'),
          onPress: () => removing && removeNow(removing),
        }}
      />
      <ConfirmDialog
        visible={confirmStop}
        icon={Store}
        title={format(t('team.stop-title'), { name: checklistName })}
        body={t('team.stop-body')}
        safe={{
          label: t('admin.cancel'),
          onPress: () => setConfirmStop(false),
        }}
        other={{
          label: t('out.stop'),
          onPress: () => {
            setConfirmStop(false);
            stopRunning.mutate(undefined, {
              onSuccess: () => setStopped(true),
              onError: () => setFailure('saveFailed'),
            });
          },
        }}
      />
    </PushedScreen>
  );
}

/** "today", or the day and month: when someone was taken off. */
function whenText(iso: string | null, today: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? today
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function MemberRow({
  member,
  first,
  spinning,
  note,
  onRemove,
}: {
  member: AssignmentMember;
  first: boolean;
  spinning: boolean;
  /** A line under the name, e.g. that they came back with a restarted outlet. */
  note?: string;
  onRemove?: () => void;
}) {
  const t = useT();
  return (
    <View
      className={cn(
        'min-h-14 flex-row items-center gap-3 px-4 py-2',
        !first && 'border-border border-t',
      )}
    >
      <Avatar name={member.full_name} />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-[15px] leading-snug">
          {member.full_name}
        </Text>
        {member.is_active ? null : (
          <View className="mt-0.5 flex-row items-center gap-1">
            <UserX className="text-foreground size-3.5 shrink-0" />
            <Text className="text-[13px] leading-snug">
              {t('people.inactive')}
            </Text>
          </View>
        )}
        {note ? (
          <Text className="mt-0.5 text-[13px] leading-snug">{note}</Text>
        ) : null}
      </View>
      {spinning ? <ActivityIndicator size="small" /> : null}
      {onRemove ? (
        <Button
          variant="outline"
          size="sm"
          disabled={spinning}
          accessibilityLabel={format(t('team.remove-aria'), {
            name: member.full_name,
          })}
          onPress={onRemove}
        >
          <Text>{t('team.remove')}</Text>
        </Button>
      ) : null}
    </View>
  );
}
