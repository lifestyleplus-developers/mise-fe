import { Text } from '@/shared/components/ui/text';
import { PendingPill } from '@/shared/components/pending-pill';
import { useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Camera, RefreshCw } from 'lucide-react-native';
import * as React from 'react';
import { Image, Platform, Pressable, View } from 'react-native';

type PhotoRowProps = {
  /** The thumbnail the upload produced, once one exists. */
  url?: string | null;
  uploading: boolean;
  /** The upload failed; the key is queued and will be retried. */
  failed: boolean;
  disabled?: boolean;
  onCapture: () => void;
  onRetake: () => void;
  onAddComment: () => void;
};

/**
 * An image task's row (bundle: photoTaken, photoUploading, photoPending).
 * Live capture only — the gallery is never offered, not even as a fallback
 * (FE Spec §7). On web, where there is no camera SDK, the capture input is a
 * file picker constrained to the environment's `camera` capture mode.
 */
export function PhotoRow({
  url,
  uploading,
  failed,
  disabled = false,
  onCapture,
  onRetake,
  onAddComment,
}: PhotoRowProps) {
  const t = useT();

  if (uploading) {
    return (
      <View className="mt-1.5 flex-row items-center gap-2">
        <PendingPill label={t('run.uploading')} />
      </View>
    );
  }

  if (url) {
    return (
      <View className="mt-1.5 gap-2">
        <Image
          source={{ uri: url }}
          className="border-border h-40 w-full rounded-2xl border"
          resizeMode="cover"
          accessibilityLabel={t('run.photo-taken')}
        />
        {failed ? <PendingPill label={t('run.photo-row-failed')} /> : null}
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={onRetake}
            disabled={disabled}
            className="border-input-edge bg-card active:bg-accent min-h-10 flex-row items-center gap-1.5 rounded-full border px-3.5"
          >
            <RefreshCw className="text-foreground size-4" />
            <Text className="font-sans-semibold text-[13px]">
              {t('run.retake')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onAddComment}
            disabled={disabled}
            className="border-input-edge bg-card active:bg-accent min-h-10 flex-row items-center rounded-full border px-3.5"
          >
            <Text className="font-sans-semibold text-[13px]">
              {t('run.add-comment')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('run.take-photo')}
      onPress={onCapture}
      disabled={disabled}
      className={cn(
        'border-input-edge bg-card mt-1.5 min-h-11 flex-row items-center justify-center gap-2 rounded-full border px-4 active:bg-accent',
        disabled && 'opacity-50',
      )}
    >
      <Camera className="text-foreground size-5" />
      <Text className="font-sans-semibold text-[15px]">
        {t('run.take-photo')}
      </Text>
    </Pressable>
  );
}

/** Hidden, or a file input on web — never a gallery-style chooser. */
export function HiddenCapture({
  onPicked,
}: {
  onPicked: (uri: string) => void;
}) {
  if (Platform.OS !== 'web') return null;
  return (
    <input
      type="file"
      accept="image/*"
      capture="environment"
      style={{ display: 'none' }}
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onPicked(URL.createObjectURL(file));
        event.target.value = '';
      }}
    />
  );
}
