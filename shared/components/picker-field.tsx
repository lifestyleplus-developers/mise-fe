import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

type PickerFieldProps = {
  label: string;
  /** The current value, already formatted for the person reading it. */
  value: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shown under the field, in red. */
  error?: string;
};

/** A form row that shows a value and opens a picker when tapped. */
function PickerField({
  label,
  value,
  onPress,
  disabled = false,
  error,
}: PickerFieldProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        className={cn(
          'bg-card min-h-14 flex-row items-center gap-3 rounded-2xl border px-4 py-2',
          error ? 'border-destructive' : 'border-input-edge',
          disabled ? 'opacity-50' : 'active:bg-accent',
        )}
      >
        <View className="min-w-0 flex-1">
          <Text className="text-muted-foreground text-[12px]">{label}</Text>
          <Text className="font-sans-semibold text-[16px]">{value}</Text>
        </View>
        <ChevronRight className="text-muted-foreground size-5" />
      </Pressable>
      {error ? (
        <Text
          accessibilityRole="alert"
          className="text-destructive-soft-foreground mt-1 px-1 text-[13px]"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export { PickerField };
export type { PickerFieldProps };
