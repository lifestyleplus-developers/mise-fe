import { classifySaveError } from '@/features/outlets/outlet-errors';
import { useOutletNotice } from '@/features/outlets/outlet-notice';
import { useCreateOutlet } from '@/features/outlets/use-outlets';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { TextField } from '@/shared/components/ui/text-field';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import * as React from 'react';
import { View } from 'react-native';

type AddOutletSheetProps = { visible: boolean; onClose: () => void };

/** The "New outlet" sheet: a name, Save and Cancel. */
export function AddOutletSheet({ visible, onClose }: AddOutletSheetProps) {
  const t = useT();
  const create = useCreateOutlet();
  const setNotice = useOutletNotice((state) => state.setNotice);
  const [name, setName] = React.useState('');

  const failure = create.isError ? classifySaveError(create.error) : null;
  const trimmed = name.trim();

  function close() {
    setName('');
    create.reset();
    onClose();
  }

  function save() {
    if (!trimmed || create.isPending) return;
    create.mutate(trimmed, {
      onSuccess: () => {
        setNotice({ kind: 'added', name: trimmed });
        close();
      },
    });
  }

  return (
    <BottomSheet
      visible={visible}
      title={t('outlets.new')}
      onDismiss={close}
      footer={
        <View className="gap-2">
          <Button
            className="w-full"
            disabled={!trimmed || create.isPending}
            onPress={save}
          >
            <Text>{t('admin.save')}</Text>
          </Button>
          <Button variant="outline" className="w-full" onPress={close}>
            <Text>{t('admin.cancel')}</Text>
          </Button>
        </View>
      }
    >
      {failure && failure !== 'name-taken' ? (
        <View className="mb-3">
          <Banner
            tone="error"
            message={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        </View>
      ) : null}
      <TextField
        label={t('outlets.name')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          create.reset();
        }}
        onSubmitEditing={save}
        returnKeyType="done"
        autoFocus
        className={failure === 'name-taken' ? 'border-destructive' : undefined}
      />
      {failure === 'name-taken' ? (
        <Text
          accessibilityRole="alert"
          className="text-destructive-soft-foreground font-sans-medium mt-1.5 px-1 text-[13px]"
        >
          {t('outlets.name-taken')}
        </Text>
      ) : null}
    </BottomSheet>
  );
}
