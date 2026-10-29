import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;

type PickerColumnOption = { value: number; label: string };

type PickerColumnProps = {
  /** The column's heading, also its accessibility label. */
  label: string;
  options: readonly PickerColumnOption[];
  value: number;
  onChange: (value: number) => void;
};

/**
 * One scrolling column of a picker. Every option is a button, so it works
 * with a screen reader and without any gesture; it opens scrolled to the
 * chosen one.
 */
function PickerColumn({ label, options, value, onChange }: PickerColumnProps) {
  const scroll = React.useRef<ScrollView>(null);
  const placed = React.useRef(false);

  function placeOnSelected() {
    if (placed.current) return;
    placed.current = true;
    const index = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    scroll.current?.scrollTo({
      y: Math.max(0, (index - 2) * ITEM_HEIGHT),
      animated: false,
    });
  }

  return (
    <View className="min-w-0 flex-1">
      <Text
        accessibilityRole="header"
        className="text-muted-foreground mb-1 text-center text-[12px]"
      >
        {label}
      </Text>
      <ScrollView
        ref={scroll}
        onLayout={placeOnSelected}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}
        className="border-border bg-background rounded-2xl border"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={{ height: ITEM_HEIGHT }}
              className={cn(
                'items-center justify-center',
                selected ? 'bg-primary' : 'active:bg-accent',
              )}
            >
              <Text
                className={cn(
                  'text-[16px]',
                  selected
                    ? 'font-sans-bold text-primary-foreground'
                    : 'font-sans-medium',
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Whole numbers from `from` to `to`, optionally zero-padded to two digits. */
function numberOptions(
  from: number,
  to: number,
  padded = false,
): PickerColumnOption[] {
  return Array.from({ length: to - from + 1 }, (_, index) => {
    const value = from + index;
    return {
      value,
      label: padded ? String(value).padStart(2, '0') : String(value),
    };
  });
}

export { PickerColumn, numberOptions };
export type { PickerColumnOption };
