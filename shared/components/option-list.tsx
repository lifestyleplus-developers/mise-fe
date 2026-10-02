import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

type Option<T extends string> = { value: T; label: string };

type OptionListProps<T extends string> = {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
};

/**
 * A card of mutually exclusive rows with a tick on the chosen one — the
 * inline form of a picker (Settings' language and theme). Selection is by
 * tap with no confirm step; the caller applies it at once.
 */
function OptionList<T extends string>({
  value,
  options,
  onChange,
}: OptionListProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      className="shadow-card border-border bg-card overflow-hidden rounded-3xl border"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            className={cn(
              'active:bg-accent min-h-14 flex-row items-center gap-3 px-4 py-2',
              index > 0 && 'border-border border-t',
            )}
          >
            <Text
              className={cn(
                'min-w-0 flex-1 text-[16px]',
                selected ? 'font-sans-bold' : 'font-sans-medium',
              )}
            >
              {option.label}
            </Text>
            {selected ? (
              <Check className="text-foreground size-5" />
            ) : (
              <View className="size-5" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export { OptionList };
export type { OptionListProps };
