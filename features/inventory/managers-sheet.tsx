import {
  useAppointInventoryManager,
  useInventoryManagers,
  useRemoveInventoryManager,
} from '@/features/inventory/use-inventory-managers';
import { useUsers } from '@/features/users/use-users';
import { NotBuiltError } from '@/shared/api/client';
import type { InventoryManager } from '@/shared/api/types';
import { Avatar } from '@/shared/components/avatar';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { PeoplePicker } from '@/shared/components/people-picker';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { UserMinus, UserPlus } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

type ManagersSheetProps = {
  outletId: number;
  outletName: string;
  onClose: () => void;
};

/** Who records stock at an outlet: the list, Add, and Remove. For ADMIN and OWNER. */
function ManagersSheet({ outletId, outletName, onClose }: ManagersSheetProps) {
  const t = useT();
  const managers = useInventoryManagers(outletId);
  const remove = useRemoveInventoryManager(outletId);
  const [picking, setPicking] = React.useState(false);
  const [removing, setRemoving] = React.useState<InventoryManager | null>(null);

  // Appointing has no endpoint on the platform yet: say so, and leave it off.
  const unavailable = managers.error instanceof NotBuiltError;
  const list = managers.data ?? [];

  if (picking) {
    return (
      <ManagerPicker
        outletId={outletId}
        already={new Set(list.map((m) => m.id))}
        onClose={() => setPicking(false)}
      />
    );
  }

  return (
    <>
      <BottomSheet
        visible={removing === null}
        title={t('inv.managers')}
        onDismiss={onClose}
        footer={
          <View className="gap-2">
            {unavailable ? (
              <Banner tone="notice" message={t('inv.mgr-unavailable')} />
            ) : null}
            <Button
              className="w-full"
              disabled={unavailable}
              onPress={() => setPicking(true)}
            >
              <UserPlus className="text-primary-foreground size-5" />
              <Text>{t('inv.mgr-add')}</Text>
            </Button>
            <Button variant="outline" className="w-full" onPress={onClose}>
              <Text>{t('att.close')}</Text>
            </Button>
          </View>
        }
      >
        {managers.isPending ? (
          <ActivityIndicator />
        ) : managers.isError && !unavailable ? (
          <Banner
            tone="error"
            message={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        ) : list.length === 0 ? (
          <Text className="px-1 text-[15px] leading-snug">
            {t('inv.mgr-none')}
          </Text>
        ) : (
          <View className="border-border overflow-hidden rounded-2xl border">
            {list.map((person, index) => (
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unavailable || remove.isPending}
                  accessibilityLabel={format(t('inv.mgr-remove-title'), {
                    name: person.full_name,
                    outlet: outletName,
                  })}
                  onPress={() => setRemoving(person)}
                >
                  <Text>{t('cfg.remove')}</Text>
                </Button>
              </View>
            ))}
          </View>
        )}
        {remove.isError ? (
          <View className="mt-3">
            <Banner
              tone="error"
              message={`${t('admin.save-failed')} ${t('common.offline')}`}
            />
          </View>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        visible={removing !== null}
        icon={UserMinus}
        title={format(t('inv.mgr-remove-title'), {
          name: removing?.full_name ?? '',
          outlet: outletName,
        })}
        body={format(t('inv.mgr-remove-body'), {
          name: removing?.full_name ?? '',
        })}
        safe={{ label: t('admin.cancel'), onPress: () => setRemoving(null) }}
        other={{
          label: t('cfg.remove'),
          onPress: () => {
            const person = removing;
            setRemoving(null);
            if (person) remove.mutate(person.id);
          },
        }}
      />
    </>
  );
}

/** Active people to appoint; those already managing here are greyed. */
function ManagerPicker({
  outletId,
  already,
  onClose,
}: {
  outletId: number;
  already: ReadonlySet<number>;
  onClose: () => void;
}) {
  const t = useT();
  const [search, setSearch] = React.useState('');
  const people = useUsers({
    isActive: true,
    search: useDebouncedValue(search.trim()),
  });
  const appoint = useAppointInventoryManager(outletId);
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | undefined>();

  const list = people.data
    ? people.data.pages
        .flatMap((page) => page.results)
        .map((person) => ({
          id: person.id,
          name: person.full_name,
          username: person.username,
          disabledReason: already.has(person.id)
            ? t('inv.mgr-already')
            : undefined,
        }))
    : undefined;

  return (
    <PeoplePicker
      visible
      title={t('inv.mgr-add-title')}
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
          onSuccess: onClose,
          onError: () => {
            setPendingId(null);
            setError(`${t('admin.save-failed')} ${t('common.offline')}`);
          },
        });
      }}
    />
  );
}

export { ManagersSheet };
