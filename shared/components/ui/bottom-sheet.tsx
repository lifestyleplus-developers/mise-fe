import { Text } from '@/shared/components/ui/text';
import * as React from 'react';
import {
  Animated,
  Keyboard,
  Modal as RNModal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  /** Called by a backdrop tap and Android's back button. */
  onDismiss: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** How far below the screen the sheet starts before springing up. */
const OFFSCREEN = 600;

/** Sheet rising from the bottom over a scrim — the mockup's picker surface (business picker, language list). */
export function BottomSheet({
  visible,
  title,
  onDismiss,
  children,
  footer,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight] = React.useState(() => new Animated.Value(0));
  const [slide] = React.useState(() => new Animated.Value(OFFSCREEN));

  // The sheet rides up with the keyboard at the keyboard's own speed.
  React.useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      Animated.timing(keyboardHeight, {
        toValue: event.endCoordinates.height,
        duration: event.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: event.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);

  // Slide up each time it opens. The scrim fades with the Modal itself, so it
  // does not travel with the sheet.
  React.useEffect(() => {
    if (!visible) return;
    slide.setValue(OFFSCREEN);
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [visible, slide]);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View className="bg-scrim flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={{ paddingBottom: keyboardHeight }}>
          <Animated.View style={{ transform: [{ translateY: slide }] }}>
            <View
              accessibilityViewIsModal
              className="border-border bg-card rounded-t-[1.75rem] border-t px-4 pt-2"
              style={{ paddingBottom: Math.max(insets.bottom, 24) }}
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
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </RNModal>
  );
}
