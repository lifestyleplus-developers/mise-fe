import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

type RunSectionProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  /** Upcoming reads as quieter than the groups you can act on. */
  muted?: boolean;
  children: React.ReactNode;
};

/** A titled card holding one group of runs. */
export function RunSection({
  icon: Icon,
  title,
  muted = false,
  children,
}: RunSectionProps) {
  return (
    <View
      accessibilityLabel={title}
      className="shadow-card border-border bg-card mx-4 mb-4 overflow-hidden rounded-3xl border"
    >
      <View className="flex-row items-center gap-2 px-4 pt-3.5 pb-1.5">
        <Icon
          className={cn(
            'size-4 shrink-0',
            muted ? 'text-muted-foreground' : 'text-foreground',
          )}
        />
        <Text
          accessibilityRole="header"
          className={cn(
            'font-sans-semibold text-[13px]',
            muted && 'text-muted-foreground',
          )}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/** First-load placeholder for a section. */
export function RunSectionSkeleton({ rows }: { rows: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="shadow-card border-border bg-card mx-4 mb-4 overflow-hidden rounded-3xl border"
    >
      <View className="px-4 pt-4 pb-2">
        <View className="bg-muted h-3 w-24 rounded-full" />
      </View>
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          className={cn(
            'min-h-16 flex-row items-center gap-3 px-4 py-3',
            index > 0 && 'border-border border-t',
          )}
        >
          <View className="flex-1 gap-2">
            <View className="bg-muted h-3.5 w-1/2 rounded-full" />
            <View className="bg-muted h-3 w-1/3 rounded-full" />
          </View>
          <View className="bg-muted h-1.5 w-16 rounded-full" />
        </View>
      ))}
    </View>
  );
}
