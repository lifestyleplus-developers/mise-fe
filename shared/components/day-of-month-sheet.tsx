import { PickerSheet, useDraft } from '@/shared/components/picker-sheet';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Pressable, View } from 'react-native';

type DayOfMonthSheetProps = {
  visible: boolean;
  title: string;
  value: number | null;
  onConfirm: (day: number) => void;
  onClose: () => void;
};

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

/** Pick a day of the month, 1 to 31, from a grid. */
function DayOfMonthSheet({
  visible,
  title,
  value,
  onConfirm,
  onClose,
}: DayOfMonthSheetProps) {
  const t = useT();
  const [draft, setDraft] = useDraft(visible, value);

  return (
    <PickerSheet
      visible={visible}
      title={title}
      onClose={onClose}
      onConfirm={() => {
        if (draft !== null) onConfirm(draft);
        else onClose();
      }}
    >
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap">
        {DAYS.map((day) => {
          const selected = day === draft;
          return (
            // Seven to a row; the width is a seventh, the tap target the full cell.
            <View key={day} style={{ width: `${100 / 7}%` }} className="p-0.5">
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={format(t('picker.day-n'), {
                  n: String(day),
                })}
                accessibilityState={{ checked: selected }}
                onPress={() => setDraft(day)}
                className={cn(
                  'h-11 items-center justify-center rounded-full',
                  selected ? 'bg-primary' : 'active:bg-accent',
                )}
              >
                <Text
                  className={cn(
                    'text-[15px]',
                    selected
                      ? 'font-sans-bold text-primary-foreground'
                      : 'font-sans-medium',
                  )}
                >
                  {day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </PickerSheet>
  );
}

export { DayOfMonthSheet };
