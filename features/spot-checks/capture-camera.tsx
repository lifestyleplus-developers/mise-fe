import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { CameraView } from 'expo-camera';
import { Flashlight, FlashlightOff } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountdownBand } from './countdown-ring';

type CaptureCameraProps = {
  windowClose: string;
  /** The prompt being photographed, with its place in the check. */
  position: number;
  prompt: string;
  /** The picture's location on the phone. */
  onPhoto: (uri: string) => void;
  /** The camera gave back no picture. */
  onNoPhoto: () => void;
  /** The camera would not start. */
  onMountError: () => void;
  onClose: () => void;
};

/**
 * The live camera (SPT-01 `camera`, `torchOn`): the prompt, `Photo n` and the time
 * left over the picture so the person never has to leave it to look at the clock,
 * with the torch on the left, the shutter in the middle and Close on the right.
 */
export function CaptureCamera({
  windowClose,
  position,
  prompt,
  onPhoto,
  onNoPhoto,
  onMountError,
  onClose,
}: CaptureCameraProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const camera = React.useRef<CameraView>(null);
  const [torch, setTorch] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function shoot() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const picture = await camera.current?.takePictureAsync({
        quality: 0.8,
        exif: false,
      });
      if (picture?.uri) onPhoto(picture.uri);
      else onNoPhoto();
    } catch {
      onNoPhoto();
    } finally {
      setBusy(false);
    }
  }

  const TorchIcon = torch ? Flashlight : FlashlightOff;

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        enableTorch={torch}
        onCameraReady={() => setReady(true)}
        onMountError={onMountError}
      />
      <View
        className="absolute inset-x-0 px-4"
        style={{ top: insets.top + 8 }}
        pointerEvents="none"
      >
        <CountdownBand
          windowClose={windowClose}
          position={position}
          prompt={prompt}
        />
      </View>
      <View
        className="absolute inset-x-0 flex-row items-center justify-between px-6"
        style={{ bottom: insets.bottom + 20 }}
      >
        <View className="flex-1 items-start">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: torch }}
            onPress={() => setTorch((on) => !on)}
            className={cn(
              'min-h-12 min-w-12 items-center justify-center gap-0.5 rounded-2xl border px-2.5 py-1.5',
              torch
                ? 'border-2 border-white bg-white/25'
                : 'border-white/40 bg-black/50',
            )}
          >
            <TorchIcon className="size-5 text-white" />
            <Text className="font-sans-semibold text-[12px] leading-tight text-white">
              {t(torch ? 'cam.torch-on' : 'cam.torch-off')}
            </Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('run.take-photo')}
          disabled={!ready || busy}
          onPress={() => void shoot()}
          className={cn(
            'size-[72px] items-center justify-center rounded-full border-4 border-white',
            (!ready || busy) && 'opacity-50',
          )}
        >
          <View className="size-[54px] rounded-full bg-white" />
        </Pressable>
        <View className="flex-1 items-end">
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="min-h-12 min-w-12 items-center justify-center rounded-2xl bg-black/50 px-3"
          >
            <Text className="font-sans-semibold text-[14px] text-white">
              {t('admin.cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
