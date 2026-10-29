import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { ChevronRight } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type SummaryRow = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** What is behind it, e.g. "12 tasks". */
  value: string;
  onPress: () => void;
};

/** Rows that lead to the rest of a checklist, each saying what it holds. */
function SummaryRows({
  rows,
  disabled = false,
}: {
  rows: SummaryRow[];
  disabled?: boolean;
}) {
  return (
    <View className="shadow-card border-border bg-card mx-4 mt-4 overflow-hidden rounded-3xl border">
      {rows.map((row, index) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={`${row.label}, ${row.value}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={row.onPress}
          className={cn(
            'min-h-14 flex-row items-center gap-3 px-4 py-2',
            index > 0 && 'border-border border-t',
            !disabled && 'active:bg-accent',
          )}
        >
          <View className="border-border size-9 shrink-0 items-center justify-center rounded-xl border">
            <row.icon className="text-foreground size-[18px]" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-sans-medium text-[15px]">{row.label}</Text>
            <Text className="text-[13px] leading-snug">{row.value}</Text>
          </View>
          {disabled ? null : (
            <ChevronRight className="text-muted-foreground size-5" />
          )}
        </Pressable>
      ))}
    </View>
  );
}

export { SummaryRows };
export type { SummaryRow };
