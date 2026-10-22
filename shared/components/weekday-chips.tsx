import { Text } from '@/shared/components/ui/text';
import { useT, type MessageKey } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Pressable, View } from 'react-native';

type WeekdayChipsProps = {
  /** 1 = Monday … 7 = Sunday. */
  value: readonly number[];
  onChange: (days: number[]) => void;
  /** The group's accessibility label, e.g. "Days". */
  label: string;
  disabled?: boolean;
  /** Shown under the chips, in red. */
  error?: string;
};

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Seven toggles, Monday first. Any number may be chosen. */
function WeekdayChips({
  value,
  onChange,
  label,
  disabled = false,
  error,
}: WeekdayChipsProps) {
  const t = useT();

  function toggle(day: number) {
    onChange(
      value.includes(day)
        ? value.filter((chosen) => chosen !== day)
        : [...value, day].sort((a, b) => a - b),
    );
  }

  return (
    <View>
      <View
        accessibilityRole="toolbar"
        accessibilityLabel={label}
        className="flex-row flex-wrap gap-2"
      >
        {DAYS.map((day) => {
          const selected = value.includes(day);
          return (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityLabel={t(`wd-full.${day}` as MessageKey)}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => toggle(day)}
              className={cn(
                'min-h-11 min-w-12 items-center justify-center rounded-full border px-3',
                selected
                  ? 'border-primary bg-primary'
                  : 'border-input-edge bg-card',
                disabled && 'opacity-50',
              )}
            >
              <Text
                className={cn(
                  'font-sans-semibold text-[14px]',
                  selected && 'text-primary-foreground',
                )}
              >
                {t(`wd.${day}` as MessageKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
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

export { WeekdayChips };
