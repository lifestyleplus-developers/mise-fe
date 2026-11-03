import { Text } from '@/shared/components/ui/text';
import { useT, type MessageKey } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import {
  Check,
  Circle,
  CircleAlert,
  CircleDashed,
  Clock,
  ImageIcon,
  RefreshCw,
} from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import type { PromptState } from './prompt-state';

const STATE: Record<
  PromptState,
  { label: MessageKey; box: string; ink: string }
> = {
  toTake: { label: 'spot.to-take', box: 'bg-muted', ink: 'text-foreground' },
  uploading: {
    label: 'spot.uploading',
    box: 'bg-muted',
    ink: 'text-foreground',
  },
  sent: {
    label: 'spot.sent',
    box: 'bg-success-soft',
    ink: 'text-success-soft-foreground',
  },
  waiting: {
    label: 'spot.waiting',
    box: 'bg-pending-soft',
    ink: 'text-pending-soft-foreground',
  },
  failed: {
    label: 'spot.upload-failed',
    box: 'bg-destructive-soft',
    ink: 'text-destructive-soft-foreground',
  },
  notTaken: {
    label: 'spot.not-taken',
    box: 'bg-muted',
    ink: 'text-foreground',
  },
  late: { label: 'spot.not-taken', box: 'bg-muted', ink: 'text-foreground' },
};

function StateGlyph({ state, ink }: { state: PromptState; ink: string }) {
  switch (state) {
    case 'sent':
      return <Check className={cn('size-4', ink)} strokeWidth={2.5} />;
    case 'uploading':
      return <ActivityIndicator size="small" />;
    case 'waiting':
      return <Clock className={cn('size-4', ink)} />;
    case 'failed':
      return <CircleAlert className={cn('size-4', ink)} />;
    case 'notTaken':
    case 'late':
      return <CircleDashed className={cn('size-4', ink)} />;
    case 'toTake':
      return <Circle className={cn('size-4', ink)} />;
  }
}

/** A line under a prompt about its photograph: who and when, or the one it replaced. */
export type PhotoLine = {
  text: string;
  /** The replaced one: smaller and quieter. */
  muted?: boolean;
  /** A picture, if there is one to draw. */
  uri?: string | null;
};

type PromptRowProps = {
  position: number;
  /** The prompt as authored; never translated. */
  prompt: string;
  state: PromptState;
  photoLines?: PhotoLine[];
  /** Why a late photograph was not recorded (SPT-01 `lateRefused`). */
  lateLine?: string;
  onRetake?: () => void;
  /** Upload failed: try the upload again. */
  onRetry?: () => void;
  /** Kept for lack of signal: try now rather than wait. */
  onSendNow?: () => void;
  first?: boolean;
};

const drawable = (uri: string | null | undefined): uri is string =>
  !!uri && !uri.startsWith('mock://');

function ActionPill({
  label,
  onPress,
  withIcon = true,
}: {
  label: string;
  onPress: () => void;
  withIcon?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="border-input-edge bg-card active:bg-accent min-h-11 flex-row items-center gap-1.5 rounded-full border px-3.5"
    >
      {withIcon ? <RefreshCw className="text-foreground size-4" /> : null}
      <Text className="font-sans-semibold text-[13px]">{label}</Text>
    </Pressable>
  );
}

/**
 * One capture prompt in the list: its number and wording, the state of its photograph
 * as a word with an icon, who took it and when, and what can be done next (Retake,
 * Retry, Send now). Several states can be true on the phone at once; fold them with
 * `promptState` first.
 */
export function PromptRow({
  position,
  prompt,
  state,
  photoLines = [],
  lateLine,
  onRetake,
  onRetry,
  onSendNow,
  first = false,
}: PromptRowProps) {
  const t = useT();
  const { label, box, ink } = STATE[state];
  return (
    <View className={cn('px-4 py-3', !first && 'border-border border-t')}>
      <View className="flex-row flex-wrap items-start gap-x-3 gap-y-2">
        <View
          accessibilityElementsHidden
          className="border-border mt-0.5 size-7 shrink-0 items-center justify-center rounded-full border"
        >
          <Text className="font-sans-semibold text-[13px]">{position}</Text>
        </View>
        <View className="min-w-[10rem] flex-1 basis-[10rem]">
          <Text className="text-[15px] leading-snug">{prompt}</Text>
          {photoLines.length > 0 ? (
            <View className="mt-2 flex-row items-start gap-2.5">
              <View
                accessibilityElementsHidden
                className="shrink-0 flex-row items-end gap-1.5"
              >
                {photoLines.map((line, index) => (
                  <View
                    key={index}
                    className={cn(
                      'border-border bg-muted items-center justify-center overflow-hidden rounded-xl border',
                      line.muted ? 'size-9 opacity-60' : 'size-12',
                    )}
                  >
                    {drawable(line.uri) ? (
                      <Image
                        source={{ uri: line.uri }}
                        className="size-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <ImageIcon
                        className={cn(
                          'text-muted-foreground',
                          line.muted ? 'size-4' : 'size-5',
                        )}
                      />
                    )}
                  </View>
                ))}
              </View>
              <View className="min-w-0 flex-1 pt-0.5">
                {photoLines.map((line, index) => (
                  <Text
                    key={index}
                    className={cn(
                      'text-[13px] leading-snug',
                      line.muted ? 'text-muted-foreground' : 'font-sans-medium',
                    )}
                  >
                    {line.text}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          {state === 'late' && lateLine ? (
            <Text className="mt-1.5 text-[13px] leading-snug">{lateLine}</Text>
          ) : null}
          {onRetake || onRetry || onSendNow ? (
            <View className="mt-2 flex-row flex-wrap gap-2">
              {onRetry ? (
                <ActionPill label={t('spot.retry')} onPress={onRetry} />
              ) : null}
              {onSendNow ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onSendNow}
                  className="active:bg-accent min-h-11 justify-center rounded-full px-2"
                >
                  <Text className="font-sans-semibold text-[13px] underline">
                    {t('spot.send-now')}
                  </Text>
                </Pressable>
              ) : null}
              {onRetake ? (
                <ActionPill label={t('spot.retake')} onPress={onRetake} />
              ) : null}
            </View>
          ) : null}
        </View>
        <View
          accessibilityRole="text"
          className={cn(
            'shrink-0 flex-row items-center gap-1 rounded-full px-2.5 py-1',
            box,
          )}
        >
          <StateGlyph state={state} ink={ink} />
          <Text className={cn('font-sans-semibold text-[12px]', ink)}>
            {t(label)}
          </Text>
        </View>
      </View>
    </View>
  );
}
