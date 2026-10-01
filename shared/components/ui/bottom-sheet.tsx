import { Text } from '@/shared/components/ui/text';
import * as React from 'react';
import { Modal as RNModal, Pressable, View } from 'react-native';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  /** Called by a backdrop tap and Android's back button. */
  onDismiss: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * Sheet rising from the bottom over a scrim — the mockup's picker surface
 * (business picker, language list). Same close paths as ModalDialog: the
 * backdrop and the back button both route through `onDismiss`, so a caller
 * that must not be dismissed mid-request simply ignores it.
 */
export function BottomSheet({
  visible,
  title,
  onDismiss,
  children,
  footer,
}: BottomSheetProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable className="bg-scrim flex-1 justify-end" onPress={onDismiss}>
        {/* No-op press so taps on the sheet do not reach the backdrop. */}
        <Pressable
          accessibilityViewIsModal
          onPress={() => {}}
          className="border-border bg-card rounded-t-[1.75rem] border-t px-4 pt-2 pb-6"
        >
          <View className="bg-border mx-auto mb-3 h-1.5 w-10 rounded-full" />
          <Text
            variant="h2"
            className="mb-3 border-b-0 px-1 pb-0 text-[22px] leading-tight"
          >
            {title}
          </Text>
          {children}
          {footer ? <View className="mt-4">{footer}</View> : null}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
