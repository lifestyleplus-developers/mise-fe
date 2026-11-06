import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { Camera, CameraOff, TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CaptureState } from './capture-machine';
import { CaptureCamera } from './capture-camera';
import { CountdownBand } from './countdown-ring';

type CaptureSheetProps = {
  state: CaptureState;
  /** The prompt being photographed, as authored. */
  prompt: string;
  windowClose: string;
  onContinue: () => void;
  onOpenSettings: () => void;
  /** Try again, on a card (camera off, would not start, no picture). */
  onAgain: () => void;
  /** Retake, on the preview. */
  onRetake: () => void;
  onUse: () => void;
  /** The live camera took a picture. */
  onPhoto: (uri: string) => void;
  onNoPhoto: () => void;
  onMountError: () => void;
  onClose: () => void;
};

/**
 * Everything on the screen while a photograph is being taken: the live camera and
 * the preview (one full-screen layer, so moving between them and on to the next
 * prompt never closes and reopens it), and the cards around them: why we ask,
 * camera off, camera would not start, no picture came back. Nothing is drawn while
 * the phone is being asked (`launching`): its own question cannot show under ours.
 */
export function CaptureSheet({
  state,
  prompt,
  windowClose,
  onContinue,
  onOpenSettings,
  onAgain,
  onRetake,
  onUse,
  onPhoto,
  onNoPhoto,
  onMountError,
  onClose,
}: CaptureSheetProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { step } = state;
  const visible = step !== 'idle' && step !== 'launching';
  if (!visible) return null;

  if (step === 'live' || (step === 'preview' && state.uri)) {
    return (
      <Modal
        visible
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        {step === 'live' ? (
          <CaptureCamera
            key={`${state.position}-live`}
            windowClose={windowClose}
            position={state.position ?? 1}
            prompt={prompt}
            onPhoto={onPhoto}
            onNoPhoto={onNoPhoto}
            onMountError={onMountError}
            onClose={onClose}
          />
        ) : (
          <View
            className="flex-1 bg-black"
            style={{
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 12,
            }}
          >
            <View className="px-4">
              <CountdownBand
                windowClose={windowClose}
                position={state.position ?? 1}
                prompt={prompt}
              />
            </View>
            <View className="my-3 flex-1">
              <Image
                source={{ uri: state.uri ?? undefined }}
                accessibilityLabel={t('cam.preview')}
                className="size-full"
                resizeMode="contain"
              />
            </View>
            <View className="flex-row gap-3 px-4">
              <Button
                variant="outline"
                className="min-h-12 flex-1 bg-white/10 border-white/40"
                onPress={onRetake}
              >
                <Text className="text-white">{t('spot.retake')}</Text>
              </Button>
              <Button className="min-h-12 flex-1 bg-white" onPress={onUse}>
                <Text className="text-black">{t('cam.use-photo')}</Text>
              </Button>
            </View>
          </View>
        )}
      </Modal>
    );
  }

  const again = state.failures > 1;
  const card =
    step === 'firstUse'
      ? {
          Icon: Camera,
          title: t('cam.name'),
          body: t('spot.why'),
          primary: { label: t('cam.continue'), onPress: onContinue },
          secondary: { label: t('cam.not-now'), onPress: onClose },
        }
      : step === 'denied'
        ? {
            Icon: CameraOff,
            title: t('cam.off-title'),
            body: t('cam.off-body'),
            primary: { label: t('cam.open-settings'), onPress: onOpenSettings },
            secondary: { label: t('cam.try-again'), onPress: onAgain },
          }
        : step === 'failed'
          ? {
              Icon: TriangleAlert,
              title: t(again ? 'cam.failed-again' : 'cam.failed'),
              body: undefined,
              primary: { label: t('cam.try-again'), onPress: onAgain },
              secondary: { label: t('admin.cancel'), onPress: onClose },
            }
          : {
              Icon: TriangleAlert,
              title: t(again ? 'cam.save-failed-again' : 'cam.save-failed'),
              body: undefined,
              primary: { label: t('cam.try-again'), onPress: onAgain },
              secondary: { label: t('admin.cancel'), onPress: onClose },
            };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        className="bg-scrim flex-1 items-center justify-center px-5"
        onPress={onClose}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={() => {}}
          className="border-border bg-card w-full max-w-sm items-center rounded-[1.75rem] border p-6"
        >
          <View className="bg-secondary mb-4 size-12 items-center justify-center rounded-full">
            <card.Icon className="text-foreground size-6" />
          </View>
          <Text className="font-sans-semibold text-center text-[18px] leading-snug">
            {card.title}
          </Text>
          {card.body ? (
            <Text className="text-muted-foreground mt-2 text-center text-[15px] leading-snug">
              {card.body}
            </Text>
          ) : null}
          <View className="mt-5 w-full gap-2">
            <Button className="w-full" onPress={card.primary.onPress}>
              <Text>{card.primary.label}</Text>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onPress={card.secondary.onPress}
            >
              <Text>{card.secondary.label}</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
