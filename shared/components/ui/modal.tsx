import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import * as React from 'react';
import { Modal as RNModal, Pressable } from 'react-native';

type ModalDialogProps = {
  visible: boolean;
  title?: string;
  message: string;
  /** Label on the single dismiss action. Defaults to "OK". */
  actionLabel?: string;
  onDismiss: () => void;
};

/** Themed alert dialog over RN's Modal — scrim backdrop, card, one action. */
export function ModalDialog({
  visible,
  title,
  message,
  actionLabel = 'OK',
  onDismiss,
}: ModalDialogProps) {
  const [shown, setShown] = React.useState({ title, message });

  React.useEffect(() => {
    if (visible) setShown({ title, message });
  }, [visible, title, message]);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-scrim px-6"
        onPress={onDismiss}
      >
        <Pressable
          accessibilityViewIsModal
          className="border-border bg-card w-full max-w-sm gap-3 rounded-[1.75rem] border p-6"
          onPress={() => {}}
        >
          {shown.title ? (
            <Text className="font-sans-semibold text-[17px]">
              {shown.title}
            </Text>
          ) : null}
          <Text className="text-muted-foreground text-[14px] leading-snug">
            {shown.message}
          </Text>

          <Button onPress={onDismiss} className="mt-1 min-h-12 w-full">
            <Text>{actionLabel}</Text>
          </Button>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
