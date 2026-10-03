import { classifyUserSaveError } from '@/features/users/user-errors';
import { assignableRoles } from '@/features/users/user-rules';
import { useCreateUser, useResetPassword } from '@/features/users/use-users';
import type { User } from '@/shared/api/types';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { Banner } from '@/shared/components/ui/banner';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { ROLE, type Role } from '@/shared/constants/roles';
import { format, useT, type MessageKey } from '@/shared/i18n';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

type Viewer = { id: number; role: Role };

function SheetButtons({
  canSave,
  onSave,
  onCancel,
}: {
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <View className="gap-2">
      <Button className="w-full" disabled={!canSave} onPress={onSave}>
        <Text>{t('admin.save')}</Text>
      </Button>
      <Button variant="outline" className="w-full" onPress={onCancel}>
        <Text>{t('admin.cancel')}</Text>
      </Button>
    </View>
  );
}

type AddUserSheetProps = {
  visible: boolean;
  viewer: Viewer;
  onClose: () => void;
  onAdded: (user: User) => void;
};

/** The "New user" sheet: name, username, initial password, role. */
export function AddUserSheet({
  visible,
  viewer,
  onClose,
  onAdded,
}: AddUserSheetProps) {
  const t = useT();
  const create = useCreateUser();
  const roles = assignableRoles(viewer);
  const [fullName, setFullName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<Role>(ROLE.MEMBER);

  const failure = create.isError ? classifyUserSaveError(create.error) : null;
  const canSave =
    Boolean(fullName.trim() && username.trim() && password) &&
    !create.isPending;

  function close() {
    setFullName('');
    setUsername('');
    setPassword('');
    setRole(ROLE.MEMBER);
    create.reset();
    onClose();
  }

  function save() {
    if (!canSave) return;
    create.mutate(
      { full_name: fullName, username, password, role },
      {
        onSuccess: (user) => {
          onAdded(user);
          close();
        },
      },
    );
  }

  return (
    <BottomSheet
      visible={visible}
      title={t('users.new')}
      onDismiss={close}
      footer={<SheetButtons canSave={canSave} onSave={save} onCancel={close} />}
    >
      <ScrollView
        className="max-h-[430px]"
        contentContainerClassName="gap-3 px-0.5 pb-1"
        keyboardShouldPersistTaps="handled"
      >
        {failure === 'failed' || failure === 'forbidden' ? (
          <Banner
            tone="error"
            message={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        ) : null}
        <TextField
          label={t('users.full-name')}
          value={fullName}
          onChangeText={(value) => {
            setFullName(value);
            create.reset();
          }}
        />
        <View>
          <TextField
            label={t('users.username')}
            value={username}
            onChangeText={(value) => {
              setUsername(value);
              create.reset();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            className={
              failure === 'username-taken' ? 'border-destructive' : undefined
            }
          />
          {failure === 'username-taken' ? (
            <Text
              accessibilityRole="alert"
              className="text-destructive-soft-foreground font-sans-medium mt-1.5 px-1 text-[13px]"
            >
              {t('users.username-taken')}
            </Text>
          ) : null}
        </View>
        <TextField
          label={t('users.password')}
          isPassword
          initiallyShown
          showLabel={t('login.show-password')}
          hideLabel={t('login.hide-password')}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View className="gap-1.5">
          <Text className="font-sans-semibold text-[13px]">
            {t('users.role')}
          </Text>
          {roles.length > 1 ? (
            <SegmentedControl
              label={t('users.role')}
              value={role}
              onChange={setRole}
              options={roles.map((value) => ({
                value,
                label: t(`role.${value}` as MessageKey),
              }))}
            />
          ) : (
            <Text className="bg-muted font-sans-medium rounded-2xl px-4 py-3 text-[15px]">
              {t(`role.${roles[0]}` as MessageKey)}
            </Text>
          )}
          <Text className="px-1 text-[13px] leading-snug">
            {t('users.role-hint')}
          </Text>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

type SetPasswordSheetProps = {
  visible: boolean;
  user: User;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/** "Set new password": a manager sets it; the person is signed out everywhere. */
export function SetPasswordSheet({
  visible,
  user,
  isSelf,
  onClose,
  onSaved,
}: SetPasswordSheetProps) {
  const t = useT();
  const reset = useResetPassword(user.id);
  const [password, setPassword] = React.useState('');

  function close() {
    setPassword('');
    reset.reset();
    onClose();
  }

  function save() {
    if (!password || reset.isPending) return;
    reset.mutate(password, {
      onSuccess: () => {
        onSaved();
        close();
      },
    });
  }

  return (
    <BottomSheet
      visible={visible}
      title={t('users.set-password')}
      onDismiss={close}
      footer={
        <SheetButtons
          canSave={Boolean(password) && !reset.isPending}
          onSave={save}
          onCancel={close}
        />
      }
    >
      <View className="gap-3">
        {reset.isError ? (
          <Banner
            tone="error"
            message={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        ) : null}
        <TextField
          label={t('users.new-password')}
          isPassword
          initiallyShown
          showLabel={t('login.show-password')}
          hideLabel={t('login.hide-password')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            reset.reset();
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Banner
          tone="notice"
          message={
            isSelf
              ? t('users.set-password-warn-self')
              : format(t('users.set-password-warn'), {
                  name: user.full_name,
                })
          }
        />
      </View>
    </BottomSheet>
  );
}
