import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { ChevronRight } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type ListGroupRow = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onSelect: () => void;
};

type ListGroupProps = {
  heading?: string;
  rows: ListGroupRow[];
};

/**
 * A titled card of tappable rows — icon tile, label, chevron. The More tab's
 * shape, and Modules' (week 8), so it lives here rather than in either.
 */
function ListGroup({ heading, rows }: ListGroupProps) {
  return (
    <View className="mx-4 mb-5">
      {heading ? (
        <Text
          accessibilityRole="header"
          className="font-sans-semibold mb-2 px-1 text-[13px] tracking-wide"
        >
          {heading}
        </Text>
      ) : null}
      <View className="shadow-card border-border bg-card overflow-hidden rounded-3xl border">
        {rows.map((row, index) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            onPress={row.onSelect}
            className={cn(
              'active:bg-accent min-h-14 flex-row items-center gap-3 px-4 py-2',
              index > 0 && 'border-border border-t',
            )}
          >
            <View className="border-border size-9 shrink-0 items-center justify-center rounded-xl border">
              <row.icon className="text-foreground size-[18px]" />
            </View>
            <Text className="font-sans-medium min-w-0 flex-1 text-[15px]">
              {row.label}
            </Text>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export { ListGroup };
export type { ListGroupProps, ListGroupRow };
