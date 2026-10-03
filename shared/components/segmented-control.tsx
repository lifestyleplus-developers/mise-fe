import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { Pressable, View } from 'react-native';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  label: string;
};

/** A few exclusive choices in one pill; labels wrap onto a second line. */
function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className="bg-muted flex-row flex-wrap gap-1 rounded-[26px] p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            className={cn(
              'min-h-11 grow items-center justify-center rounded-full border px-3',
              selected ? 'border-input-edge bg-card' : 'border-transparent',
            )}
          >
            <Text
              className={cn(
                'font-sans-semibold text-center text-[14px]',
                !selected && 'text-muted-foreground',
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export { SegmentedControl };
