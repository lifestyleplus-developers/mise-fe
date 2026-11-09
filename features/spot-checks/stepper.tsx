import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { Minus, Plus } from 'lucide-react-native';
import { View } from 'react-native';

type StepperProps = {
  /** The value as shown, e.g. `20 min` or `5`. */
  display: string;
  lessLabel: string;
  moreLabel: string;
  onLess: () => void;
  onMore: () => void;
  lessDisabled?: boolean;
  moreDisabled?: boolean;
  disabled?: boolean;
};

/** A value changed by a step either way (the reveal window, an item's weight). */
export function Stepper({
  display,
  lessLabel,
  moreLabel,
  onLess,
  onMore,
  lessDisabled = false,
  moreDisabled = false,
  disabled = false,
}: StepperProps) {
  return (
    <View className="flex-row items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        className="border-input-edge size-11"
        accessibilityLabel={lessLabel}
        disabled={disabled || lessDisabled}
        onPress={onLess}
      >
        <Minus className="text-foreground size-4" />
      </Button>
      <Text
        accessibilityRole="adjustable"
        accessibilityLiveRegion="polite"
        className="font-sans-bold min-w-20 text-center text-[17px]"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {display}
      </Text>
      <Button
        variant="outline"
        size="icon"
        className="border-input-edge size-11"
        accessibilityLabel={moreLabel}
        disabled={disabled || moreDisabled}
        onPress={onMore}
      >
        <Plus className="text-foreground size-4" />
      </Button>
    </View>
  );
}
