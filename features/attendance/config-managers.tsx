import { classifyConfigError } from '@/features/attendance/config-errors';
import {
  useAppointManager,
  useRemoveManager,
} from '@/features/attendance/use-attendance-configs';
import { useUsers } from '@/features/users/use-users';
import type { AttendanceConfig, AttendanceManager } from '@/shared/api/types';
import { Avatar } from '@/shared/components/avatar';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { PeoplePicker } from '@/shared/components/people-picker';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { Info, UserMinus, UserPlus, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

type ConfigManagersProps = {
  config: AttendanceConfig;
  /** Read-only: the role was lost, or the configuration is archived. */
  disabled: boolean;
  /** Opens the picker straight away, as after a new configuration is saved. */
  openPicker?: boolean;
  onNotice: (text: string) => void;
  /** A refusal that means the screen cannot go on (403, or the configuration is gone). */
  onLocked: (kind: 'forbidden' | 'gone') => void;
};

/** Who can mark this configuration's sessions: the list, Add, and Remove (warns on the last). */
function ConfigManagers({
  config,
  disabled,
  openPicker = false,
  onNotice,
  onLocked,
}: ConfigManagersProps) {
  const t = useT();
  const remove = useRemoveManager(config.id);
  const [picking, setPicking] = React.useState(openPicker);
  const [removing, setRemoving] = React.useState<AttendanceManager | null>(
    null,
  );
  const [removeFailed, setRemoveFailed] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<number | null>(null);

  const count = config.managers.length;
  const heading = format(t('cfg.managers'), { n: String(count) });

  function confirmRemove() {
    const person = removing;
    if (!person) return;
    setRemoving(null);
    setRemoveFailed(false);
    setPendingId(person.id);
    remove.mutate(person.id, {
      onSuccess: () =>
        onNotice(
          format(t('cfg.manager-removed'), {
            name: person.full_name,
            cfg: config.name,
          }),
        ),
      onError: (error) => {
        const kind = classifyConfigError(error);
        if (kind === 'forbidden' || kind === 'gone') onLocked(kind);
        else setRemoveFailed(true);
      },
      onSettled: () => setPendingId(null),
    });
  }

  return (
    <View className="mt-5">
      <Text
        accessibilityRole="header"
        className="font-display mx-5 mb-2 text-[17px] leading-tight"
      >
        {heading}
      </Text>

      {removeFailed ? (
        <View className="mx-4 mb-3">
          <Banner
            tone="error"
            message={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        </View>
      ) : null}

      {count === 0 ? (
        <View className="shadow-card border-border bg-card mx-4 flex-row items-center gap-2 rounded-3xl border px-4 py-4">
          <Info className="text-foreground size-4 shrink-0" />
          <Text className="min-w-0 flex-1 text-[14px] leading-snug">
            {t('cfg.no-manager')}
          </Text>
        </View>
      ) : (
        <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
          {config.managers.map((person, index) => (
            <View
              key={person.id}
              className={`min-h-14 flex-row items-center gap-3 px-4 py-2 ${
                index > 0 ? 'border-border border-t' : ''
              }`}
            >
              <Avatar name={person.full_name} />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-medium text-[15px] leading-snug">
                  {person.full_name}
                </Text>
                <Text className="text-muted-foreground text-[13px]">
                  @{person.username}
                </Text>
              </View>
              {disabled ? null : pendingId === person.id ? (
                <ActivityIndicator size="small" />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={format(t('cfg.remove-title'), {
                    name: person.full_name,
                    cfg: config.name,
                  })}
                  onPress={() => setRemoving(person)}
                  className="active:bg-accent size-11 items-center justify-center rounded-full"
                >
                  <X className="text-foreground size-5" />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {disabled ? null : (
        <View className="mx-4 mt-3">
          <Button
            variant="outline"
            className="w-full"
            onPress={() => setPicking(true)}
          >
            <UserPlus className="text-foreground size-[18px]" />
            <Text>{t('cfg.add-manager')}</Text>
          </Button>
        </View>
      )}

      {picking ? (
        <ManagerPicker
          config={config}
          onClose={() => setPicking(false)}
          onAdded={(name) =>
            onNotice(format(t('cfg.manager-added'), { name, cfg: config.name }))
          }
          onLocked={onLocked}
        />
      ) : null}

      <ConfirmDialog
        visible={removing !== null}
        icon={UserMinus}
        tone={count <= 1 ? 'warning' : 'neutral'}
        title={format(t('cfg.remove-title'), {
          name: removing?.full_name ?? '',
          cfg: config.name,
        })}
        body={[
          format(t('cfg.remove-body'), { name: removing?.full_name ?? '' }),
          count <= 1 ? format(t('cfg.remove-last'), { cfg: config.name }) : '',
        ]
          .filter(Boolean)
          .join('\n\n')}
        safe={{ label: t('admin.cancel'), onPress: () => setRemoving(null) }}
        other={{ label: t('cfg.remove'), onPress: confirmRemove }}
      />
    </View>
  );
}

/** Active people to appoint; those already managing are greyed "Manager here". */
function ManagerPicker({
  config,
  onClose,
  onAdded,
  onLocked,
}: {
  config: AttendanceConfig;
  onClose: () => void;
  onAdded: (name: string) => void;
  onLocked: (kind: 'forbidden' | 'gone') => void;
}) {
  const t = useT();
  const [search, setSearch] = React.useState('');
  const people = useUsers({
    isActive: true,
    search: useDebouncedValue(search.trim()),
  });
  const appoint = useAppointManager(config.id);
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | undefined>();
  const already = new Set(config.managers.map((m) => m.id));

  const list = people.data
    ? people.data.pages
        .flatMap((page) => page.results)
        .map((person) => ({
          id: person.id,
          name: person.full_name,
          username: person.username,
          disabledReason: already.has(person.id)
            ? t('cfg.manager-here')
            : undefined,
        }))
    : undefined;

  return (
    <PeoplePicker
      visible
      title={t('cfg.add-manager')}
      people={list}
      loading={people.isPending}
      onSearchChange={setSearch}
      searching={people.isPlaceholderData}
      hasMore={people.hasNextPage}
      loadingMore={people.isFetchingNextPage}
      onLoadMore={() => void people.fetchNextPage()}
      failed={people.isError}
      onRetry={() => void people.refetch()}
      pendingId={pendingId}
      error={error}
      onClose={onClose}
      onPick={(person) => {
        setError(undefined);
        setPendingId(person.id);
        appoint.mutate(person.id, {
          onSuccess: () => {
            onAdded(person.name);
            onClose();
          },
          onError: (cause) => {
            setPendingId(null);
            const kind = classifyConfigError(cause);
            if (kind === 'forbidden' || kind === 'gone') {
              onClose();
              onLocked(kind);
            } else {
              setError(`${t('admin.save-failed')} ${t('common.offline')}`);
            }
          },
        });
      }}
    />
  );
}

export { ConfigManagers };
