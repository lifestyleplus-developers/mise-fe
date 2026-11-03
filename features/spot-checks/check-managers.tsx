import { useUsers } from '@/features/users/use-users';
import { NotBuiltError } from '@/shared/api/client';
import type { SpotCheckManager } from '@/shared/api/types';
import { Avatar } from '@/shared/components/avatar';
import { PeoplePicker } from '@/shared/components/people-picker';
import { Skeleton } from '@/shared/components/skeleton';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { UserPlus } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { classifyAreaError } from './area-errors';
import {
  useAppointSpotCheckManager,
  useRemoveSpotCheckManager,
  useSpotCheckManagers,
} from './use-spot-check-managers';

type CheckManagersProps = {
  outletId: number;
  /** Read-only: the role was lost. */
  disabled: boolean;
  /** The list is known, so the screen can warn when it is empty. */
  onKnown?: (managers: readonly SpotCheckManager[]) => void;
  /** A refusal that means the screen cannot go on. */
  onLocked: () => void;
};

/**
 * Who takes spot checks at this outlet (not per check): the people told when any
 * check here is revealed. Add and Remove take effect at once. The platform has no
 * way to do either yet, and says so in the one line the mockup gives.
 */
export function CheckManagers({
  outletId,
  disabled,
  onKnown,
  onLocked,
}: CheckManagersProps) {
  const t = useT();
  const managers = useSpotCheckManagers(outletId);
  const remove = useRemoveSpotCheckManager(outletId);
  const [picking, setPicking] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [notWired, setNotWired] = React.useState(false);

  React.useEffect(() => {
    if (managers.data) onKnown?.(managers.data);
  }, [managers.data, onKnown]);

  const people = managers.data ?? [];
  const unavailable = notWired || managers.error instanceof NotBuiltError;

  function fail(error: unknown) {
    if (error instanceof NotBuiltError) setNotWired(true);
    else if (classifyAreaError(error) === 'forbidden') onLocked();
  }

  return (
    <View className="mx-4 mt-5">
      <Text
        accessibilityRole="header"
        className="font-display px-1 text-[20px] leading-tight"
      >
        {t('spot.managers')}
      </Text>

      {managers.isPending ? (
        <Skeleton className="mt-2 h-14 rounded-3xl" />
      ) : people.length > 0 ? (
        <View className="shadow-card border-border bg-card mt-2 overflow-hidden rounded-3xl border">
          {people.map((person, index) => (
            <View
              key={person.id}
              className={`min-h-14 flex-row items-center gap-3 px-4 py-2 ${
                index > 0 ? 'border-border border-t' : ''
              }`}
            >
              <Avatar name={person.full_name} />
              <Text className="font-sans-medium min-w-0 flex-1 text-[15px] leading-snug">
                {person.full_name}
              </Text>
              {disabled ? null : pendingId === person.id ? (
                <ActivityIndicator size="small" />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setPendingId(person.id);
                    remove.mutate(person.id, {
                      onError: fail,
                      onSettled: () => setPendingId(null),
                    });
                  }}
                  className="border-input-edge bg-card active:bg-accent min-h-11 justify-center rounded-full border px-3.5"
                >
                  <Text className="font-sans-semibold text-[13px]">
                    {t('spot.remove')}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-muted-foreground mt-1 px-1 text-[14px]">
          {t('inv.none')}
        </Text>
      )}

      {unavailable ? (
        <Text
          accessibilityRole="alert"
          className="font-sans-medium mt-2 px-1 text-[14px]"
        >
          {t('spot.not-wired')}
        </Text>
      ) : null}

      {disabled ? null : (
        <Button
          variant="outline"
          className="border-input-edge mt-2 w-full"
          onPress={() => setPicking(true)}
        >
          <UserPlus className="text-foreground size-[18px]" />
          <Text>{t('spot.add-manager')}</Text>
        </Button>
      )}

      {picking ? (
        <ManagerPicker
          outletId={outletId}
          already={new Set(people.map((person) => person.id))}
          onClose={() => setPicking(false)}
          onFail={fail}
        />
      ) : null}
    </View>
  );
}

/** Active people to appoint; those already managing here are greyed. */
function ManagerPicker({
  outletId,
  already,
  onClose,
  onFail,
}: {
  outletId: number;
  already: ReadonlySet<number>;
  onClose: () => void;
  onFail: (error: unknown) => void;
}) {
  const t = useT();
  const [search, setSearch] = React.useState('');
  const users = useUsers({
    isActive: true,
    search: useDebouncedValue(search.trim()),
  });
  const appoint = useAppointSpotCheckManager(outletId);
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | undefined>();

  const list = users.data
    ? users.data.pages
        .flatMap((page) => page.results)
        .map((person) => ({
          id: person.id,
          name: person.full_name,
          username: person.username,
          disabledReason: already.has(person.id)
            ? t('spot.already-manager')
            : undefined,
        }))
    : undefined;

  return (
    <PeoplePicker
      visible
      title={t('spot.add-manager')}
      people={list}
      loading={users.isPending}
      onSearchChange={setSearch}
      searching={users.isPlaceholderData}
      hasMore={users.hasNextPage}
      loadingMore={users.isFetchingNextPage}
      onLoadMore={() => void users.fetchNextPage()}
      failed={users.isError}
      onRetry={() => void users.refetch()}
      pendingId={pendingId}
      error={error}
      onClose={onClose}
      onPick={(person) => {
        setError(undefined);
        setPendingId(person.id);
        appoint.mutate(person.id, {
          onSuccess: onClose,
          onError: (cause) => {
            setPendingId(null);
            // A lost role or an endpoint the platform lacks ends the picking; any
            // other failure stays in the picker, with the people still listed.
            if (
              cause instanceof NotBuiltError ||
              classifyAreaError(cause) === 'forbidden'
            ) {
              onClose();
              onFail(cause);
            } else {
              setError(`${t('admin.save-failed')} ${t('common.offline')}`);
            }
          },
        });
      }}
    />
  );
}
