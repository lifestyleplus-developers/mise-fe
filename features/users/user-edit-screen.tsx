import { useMe } from '@/features/auth/use-me';
import { InactiveBadge } from '@/features/users/inactive-badge';
import {
  classifyUserSaveError,
  isForbidden,
} from '@/features/users/user-errors';
import { assignableRoles, userRules } from '@/features/users/user-rules';
import { SetPasswordSheet } from '@/features/users/user-sheets';
import { useUpdateUser, useUser } from '@/features/users/use-users';
import { PushedScreen } from '@/features/shell/pushed-screen';
import type { User } from '@/shared/api/types';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { Skeleton } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import type { Role } from '@/shared/constants/roles';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useLocalSearchParams } from 'expo-router';
import { KeyRound, Lock, UserX } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

const CARD = 'shadow-card border-border bg-card mx-4 rounded-3xl border';

/** User edit (ADM-02): name, role, set password, deactivate. */
export function UserEditScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { data: me } = useMe();
  const {
    data: user,
    isError,
    error,
    refetch,
    isRefetching,
  } = useUser(Number(rawId));

  const forbidden = isError && isForbidden(error);

  return (
    <PushedScreen
      title={user?.full_name ?? t('more.users')}
      adminOnly
      backHref="/users"
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
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
              onRetry={() => void refetch()}
              retrying={isRefetching}
            />
          ) : null}
          {!user || !me ? (
            isError ? null : (
              <EditSkeleton />
            )
          ) : (
            <UserForm
              key={user.id}
              user={user}
              viewer={{ id: me.user.id, role: me.user.role }}
            />
          )}
        </>
      )}
    </PushedScreen>
  );
}

function EditSkeleton() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`${CARD} gap-4 p-4`}
    >
      {[0, 1, 2].map((key) => (
        <View key={key} className="gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 rounded-2xl" />
        </View>
      ))}
    </View>
  );
}

function ReadOnlyRow({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-muted flex-row items-center gap-2 rounded-2xl px-4 py-3">
      {children}
    </View>
  );
}

function UserForm({
  user,
  viewer,
}: {
  user: User;
  viewer: { id: number; role: Role };
}) {
  const t = useT();
  const rules = userRules(viewer, user);
  const save = useUpdateUser(user.id);
  const statusChange = useUpdateUser(user.id);
  const [name, setName] = React.useState(user.full_name);
  const [role, setRole] = React.useState<Role>(user.role);
  const [settingPassword, setSettingPassword] = React.useState(false);
  const [passwordSaved, setPasswordSaved] = React.useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = React.useState(false);

  const failure = [save, statusChange]
    .filter((mutation) => mutation.isError)
    .map((mutation) => classifyUserSaveError(mutation.error))[0];
  const changed = name.trim() !== user.full_name || role !== user.role;
  const roleLabel = (value: Role) => t(`role.${value}` as MessageKey);

  function doSave() {
    if (!name.trim() || !changed || save.isPending) return;
    save.mutate({ full_name: name, role });
  }

  return (
    <>
      <View className="mx-4 mb-3 gap-3">
        {user.is_active ? null : <InactiveBadge />}
        {failure === 'forbidden' ? (
          <Banner tone="error" message={t('users.no-longer-access')} />
        ) : failure ? (
          <Banner
            tone="error"
            message={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        ) : null}
        {passwordSaved ? (
          <Banner
            tone="notice"
            message={
              rules.isSelf
                ? t('users.password-saved-self')
                : format(t('users.password-saved'), { name: user.full_name })
            }
          />
        ) : null}
      </View>

      <View className={`${CARD} gap-4 p-4`}>
        <TextField
          label={t('users.full-name')}
          value={name}
          editable={user.is_active}
          onChangeText={(value) => {
            setName(value);
            save.reset();
          }}
          onSubmitEditing={doSave}
          returnKeyType="done"
        />
        <View className="gap-1.5">
          <Text className="font-sans-semibold text-[13px]">
            {t('users.username')}
          </Text>
          <ReadOnlyRow>
            <Lock className="text-muted-foreground size-4 shrink-0" />
            <Text className="text-[15px]">@{user.username}</Text>
          </ReadOnlyRow>
          <Text className="px-1 text-[13px]">{t('users.username-locked')}</Text>
        </View>
        <View className="gap-1.5">
          <Text className="font-sans-semibold text-[13px]">
            {t('users.role')}
          </Text>
          {rules.canChangeRole ? (
            <SegmentedControl
              label={t('users.role')}
              value={role}
              onChange={(value) => {
                setRole(value);
                save.reset();
              }}
              options={assignableRoles(viewer).map((value) => ({
                value,
                label: roleLabel(value),
              }))}
            />
          ) : (
            <Text className="bg-muted font-sans-medium rounded-2xl px-4 py-3 text-[15px]">
              {roleLabel(user.role)}
            </Text>
          )}
        </View>
        {user.is_active ? (
          <Button
            disabled={!name.trim() || !changed || save.isPending}
            onPress={doSave}
          >
            <Text>{t('admin.save')}</Text>
          </Button>
        ) : null}
      </View>

      <View className="mx-4 mt-4 gap-2">
        {rules.canSetPassword ? (
          <Button variant="outline" onPress={() => setSettingPassword(true)}>
            <KeyRound className="text-foreground size-4" />
            <Text>{t('users.set-password')}</Text>
          </Button>
        ) : rules.note ? (
          <Text className="px-1 text-[13px]">
            {t(
              rules.note === 'owner'
                ? 'users.owner-note'
                : 'users.peer-admin-note',
            )}
          </Text>
        ) : null}
        {user.is_active ? null : (
          <Button
            variant="outline"
            disabled={statusChange.isPending}
            onPress={() => statusChange.mutate({ is_active: true })}
          >
            <Text>{t('users.reactivate')}</Text>
          </Button>
        )}
      </View>

      {rules.canDeactivate ? (
        <View className="mx-4 mt-8">
          <Button
            variant="outline"
            disabled={statusChange.isPending}
            onPress={() => {
              statusChange.reset();
              setConfirmingDeactivate(true);
            }}
            className="border-destructive/50 bg-card min-h-12 w-full px-5"
          >
            <UserX className="text-destructive-soft-foreground size-[18px]" />
            <Text className="text-destructive-soft-foreground font-sans-semibold text-[15px]">
              {t('users.deactivate')}
            </Text>
          </Button>
        </View>
      ) : null}

      <SetPasswordSheet
        visible={settingPassword}
        user={user}
        isSelf={rules.isSelf}
        onClose={() => setSettingPassword(false)}
        onSaved={() => setPasswordSaved(true)}
      />

      <ConfirmDialog
        visible={confirmingDeactivate}
        icon={UserX}
        tone="warning"
        title={format(t('users.deactivate-title'), { name: user.full_name })}
        body={format(t('users.deactivate-body'), { name: user.full_name })}
        safe={{
          label: t('admin.cancel'),
          onPress: () => setConfirmingDeactivate(false),
        }}
        other={{
          label: t('users.deactivate'),
          onPress: () => {
            setConfirmingDeactivate(false);
            statusChange.mutate({ is_active: false });
          },
        }}
      />
    </>
  );
}
