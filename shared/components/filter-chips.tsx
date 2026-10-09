import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { Pressable, ScrollView } from 'react-native';

type Option<T extends string> = { value: T; label: string };

type FilterChipsProps<T extends string> = {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  label: string;
};

/** A scrolling row of exclusive filter chips. */
function FilterChips<T extends string>({
  value,
  options,
  onChange,
  label,
}: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      contentContainerClassName="gap-2"
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
              'min-h-11 shrink-0 items-center justify-center rounded-full border px-4',
              selected
                ? 'border-primary bg-primary'
                : 'border-input-edge bg-card',
            )}
          >
            <Text
              className={cn(
                'font-sans-semibold text-[14px]',
                selected && 'text-primary-foreground',
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export { FilterChips };
