import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { View } from 'react-native';

type DescriptionRow = { label: string; value: string };

/** Read-only label/value rows in a card — a profile, a detail panel. */
function DescriptionList({ rows }: { rows: DescriptionRow[] }) {
  return (
    <View className="shadow-card border-border bg-card overflow-hidden rounded-3xl border">
      {rows.map((row, index) => (
        <View
          key={row.label}
          className={cn(
            'flex-row flex-wrap items-baseline gap-x-3 px-4 py-3',
            index > 0 && 'border-border border-t',
          )}
        >
          <Text className="text-muted-foreground font-sans-semibold min-w-[7rem] text-[13px]">
            {row.label}
          </Text>
          <Text className="font-sans-medium min-w-0 flex-1 text-[15px]">
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export { DescriptionList };
export type { DescriptionRow };
