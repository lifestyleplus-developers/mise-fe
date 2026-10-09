import { Text } from '@/shared/components/ui/text';
import { ChevronDown, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

type FilterChipProps = {
  label: string;
  /** The chosen value; when set the chip turns solid and shows a clear button. */
  value: string | undefined;
  clearLabel: string;
  onOpen: () => void;
  onClear: () => void;
};

/** A dropdown-style filter chip: "All outlets ▾", or "Koramangala ▾ ✕" once picked. */
export function FilterChip({
  label,
  value,
  clearLabel,
  onOpen,
  onClear,
}: FilterChipProps) {
  if (!value) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        className="border-input-edge bg-card active:bg-accent min-h-11 shrink-0 flex-row items-center gap-1 rounded-full border px-3.5"
      >
        <Text className="font-sans-semibold text-[13px]">{label}</Text>
        <ChevronDown className="text-foreground size-4" />
      </Pressable>
    );
  }

  return (
    <View className="bg-primary min-h-11 max-w-full min-w-0 flex-row items-center rounded-[22px]">
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        className="min-h-11 min-w-0 shrink flex-row items-center gap-1 py-1.5 pr-1 pl-3.5"
      >
        <Text className="font-sans-semibold text-primary-foreground shrink text-[13px]">
          {value}
        </Text>
        <ChevronDown className="text-primary-foreground size-4 shrink-0" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${clearLabel}: ${value}`}
        onPress={onClear}
        className="size-11 shrink-0 items-center justify-center"
      >
        <X className="text-primary-foreground size-4" />
      </Pressable>
    </View>
  );
}
