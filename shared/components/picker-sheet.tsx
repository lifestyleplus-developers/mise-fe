import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import * as React from 'react';
import { View } from 'react-native';

type PickerSheetProps = {
  visible: boolean;
  title: string;
  /** Done: takes the draft. */
  onConfirm: () => void;
  /** Cancel, backdrop and Android back: leaves the value as it was. */
  onClose: () => void;
  children: React.ReactNode;
};

/** The frame the time, duration and day pickers share: Done and Cancel. */
function PickerSheet({
  visible,
  title,
  onConfirm,
  onClose,
  children,
}: PickerSheetProps) {
  const t = useT();
  return (
    <BottomSheet
      visible={visible}
      title={title}
      onDismiss={onClose}
      footer={
        <View className="gap-2">
          <Button className="w-full" onPress={onConfirm}>
            <Text>{t('picker.done')}</Text>
          </Button>
          <Button variant="outline" className="w-full" onPress={onClose}>
            <Text>{t('admin.cancel')}</Text>
          </Button>
        </View>
      }
    >
      {children}
    </BottomSheet>
  );
}

/**
 * A sheet's draft starts from the saved value each time it opens, and is
 * thrown away if it is cancelled. Returns the draft and its setter.
 */
function useDraft<T>(visible: boolean, value: T) {
  const [draft, setDraft] = React.useState(value);
  const [wasVisible, setWasVisible] = React.useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(value);
  }
  return [draft, setDraft] as const;
}

export { PickerSheet, useDraft };
