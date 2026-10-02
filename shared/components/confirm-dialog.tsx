import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import * as React from 'react';
import { Modal, Pressable, View } from 'react-native';

type ConfirmAction = { label: string; onPress: () => void };

type ConfirmDialogProps = {
  visible: boolean;
  icon: React.ComponentType<{ className?: string }>;
  /** `warning` is for a confirm that carries a consequence worth reading. */
  tone?: 'neutral' | 'warning';
  title: string;
  body?: string;
  /** The way out that changes nothing — the filled, default button. */
  safe: ConfirmAction;
  /** The way through — outlined and red, so it never reads as the default. */
  other: ConfirmAction;
};

/**
 * Two-way confirm over RN's Modal. The safe action is the filled one on the
 * left and the consequential one is outlined destructive on the right; a backdrop
 * tap or Android back takes the safe action.
 */
function ConfirmDialog({
  visible,
  icon: Icon,
  tone = 'neutral',
  title,
  body,
  safe,
  other,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={safe.onPress}
    >
      <Pressable
        className="bg-scrim flex-1 items-center justify-center px-5"
        onPress={safe.onPress}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={() => {}}
          className="border-border bg-card w-full max-w-sm items-center rounded-[1.75rem] border p-6"
        >
          <View
            className={cn(
              'mb-4 size-12 items-center justify-center rounded-full',
              tone === 'warning' ? 'bg-warning-soft' : 'bg-secondary',
            )}
          >
            <Icon
              className={cn(
                'size-6',
                tone === 'warning'
                  ? 'text-warning-soft-foreground'
                  : 'text-foreground',
              )}
            />
          </View>
          <Text
            variant="h3"
            className="text-center text-[22px] leading-tight"
            accessibilityRole="header"
          >
            {title}
          </Text>
          {body ? (
            <Text className="mt-2 text-center text-[14px] leading-snug">
              {body}
            </Text>
          ) : null}
          {/* Side by side, equal width. A long label (Malayalam and Kannada
              run well past English) wraps inside its button, which grows to
              fit — hence h-auto — instead of truncating or pushing the other
              button off the card. */}
          <View className="mt-6 w-full flex-row gap-2">
            <Button
              onPress={safe.onPress}
              className="h-auto min-h-11 flex-1 px-3 py-2"
            >
              <Text className="font-sans-semibold text-center text-[14px]">
                {safe.label}
              </Text>
            </Button>
            <Button
              variant="outline"
              onPress={other.onPress}
              className="border-destructive/50 h-auto min-h-11 flex-1 px-3 py-2"
            >
              <Text className="text-destructive-soft-foreground font-sans-semibold text-center text-[14px]">
                {other.label}
              </Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
