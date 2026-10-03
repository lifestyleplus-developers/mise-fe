import { cn } from '@/shared/lib/utils';
import { View } from 'react-native';

/** A muted placeholder bar. */
function Skeleton({ className }: { className?: string }) {
  return <View className={cn('bg-muted rounded-full', className)} />;
}

/** Placeholder for a loading list card. */
function SkeletonRows({
  count = 3,
  avatar = false,
}: {
  count?: number;
  avatar?: boolean;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border"
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className={cn(
            'min-h-14 flex-row items-center gap-3 px-4 py-2',
            index > 0 && 'border-border border-t',
          )}
        >
          <Skeleton
            className={avatar ? 'size-10 rounded-full' : 'size-9 rounded-xl'}
          />
          <Skeleton className="h-3.5 w-2/5" />
        </View>
      ))}
    </View>
  );
}

export { Skeleton, SkeletonRows };
