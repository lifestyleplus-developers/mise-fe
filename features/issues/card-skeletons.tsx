import { Skeleton } from '@/shared/components/skeleton';
import { View } from 'react-native';

/** Placeholder cards while a list of issues loads. */
export function CardSkeletons({ count }: { count: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="gap-3"
    >
      {Array.from({ length: count }, (_, key) => (
        <View
          key={key}
          className="shadow-card border-border bg-card mx-4 gap-2.5 rounded-3xl border p-4"
        >
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="mt-1 h-3.5 w-2/3" />
        </View>
      ))}
    </View>
  );
}
