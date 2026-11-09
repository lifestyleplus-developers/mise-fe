import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { useSpotCountdown } from './use-spot-countdown';

type CountdownRingProps = {
  /** `window_close` of a revealed run. */
  windowClose: string;
  /** Says what happens when time runs out. On by default: the countdown must be honest about it. */
  showNote?: boolean;
};

/**
 * The countdown is the feature (FE Spec §3.11). A ring with the time left in it,
 * heavier in the last five minutes and said in words too, and under it the plain
 * truth: if time runs out the check is recorded as not done, and cannot be redone.
 */
export function CountdownRing({
  windowClose,
  showNote = true,
}: CountdownRingProps) {
  const t = useT();
  const { value, final } = useSpotCountdown(windowClose);
  return (
    <View className="mx-4 mb-3 items-center gap-2">
      <View
        accessibilityRole="timer"
        accessibilityLabel={`${value} ${t('spot.left')}${final ? `, ${t('spot.final')}` : ''}`}
        className={cn(
          'bg-card size-40 items-center justify-center rounded-full',
          final ? 'border-foreground border-[6px]' : 'border-border border-2',
        )}
      >
        <Text
          className="font-sans-bold text-[44px] leading-none tracking-tight"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
        <Text className="font-sans-semibold mt-1 text-[14px]">
          {t('spot.left')}
        </Text>
      </View>
      {final ? (
        <View className="bg-warning-soft flex-row items-center gap-1.5 rounded-full px-3 py-1">
          <TriangleAlert className="text-warning-soft-foreground size-4" />
          <Text className="font-sans-bold text-warning-soft-foreground text-[14px]">
            {t('spot.final')}
          </Text>
        </View>
      ) : null}
      {showNote ? (
        <Text className="max-w-[34ch] text-center text-[14px] leading-snug">
          {t('spot.runs-out')}
        </Text>
      ) : null}
    </View>
  );
}

type CountdownBandProps = {
  windowClose: string;
  /** `Photo 2` and the prompt itself, as the camera shows them. */
  position: number;
  prompt: string;
};

/**
 * The strip over the camera: which prompt this photograph answers, and the time
 * left, so the person never has to leave the camera to look at the clock.
 */
export function CountdownBand({
  windowClose,
  position,
  prompt,
}: CountdownBandProps) {
  const t = useT();
  const { value, final } = useSpotCountdown(windowClose);
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-black/70 px-4 py-3">
      <View className="min-w-0 flex-1">
        <Text className="font-sans-semibold text-[12px] text-white/80">
          {format(t('spot.photo-n'), { n: String(position) })}
        </Text>
        <Text className="text-[15px] leading-snug text-white">{prompt}</Text>
      </View>
      <View
        accessibilityRole="timer"
        accessibilityLabel={`${value} ${t('spot.left')}`}
        className={cn(
          'items-center rounded-xl px-3 py-1.5',
          final ? 'bg-white' : 'bg-white/20',
        )}
      >
        <Text
          className={cn(
            'font-sans-bold text-[20px] leading-none',
            final ? 'text-black' : 'text-white',
          )}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
