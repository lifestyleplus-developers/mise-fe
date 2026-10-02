import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { Pressable, View } from 'react-native';

type SwitchRowProps = {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** A label, optional hint, and an on/off switch. Sits inside a card. */
function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: SwitchRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      className="min-h-14 flex-row items-center gap-3 px-4 py-2 disabled:opacity-60"
    >
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-[15px]">{label}</Text>
        {hint ? (
          <Text className="text-muted-foreground text-[13px] leading-snug">
            {hint}
          </Text>
        ) : null}
      </View>
      <View
        className={cn(
          'h-8 w-[52px] shrink-0 rounded-full border',
          checked ? 'border-primary bg-primary' : 'border-input-edge bg-muted',
        )}
      >
        <View
          className={cn(
            'bg-card absolute top-[3px] size-6 rounded-full border',
            checked
              ? 'border-primary left-[23px]'
              : 'border-input-edge left-[3px]',
          )}
        />
      </View>
    </Pressable>
  );
}

export { SwitchRow };
