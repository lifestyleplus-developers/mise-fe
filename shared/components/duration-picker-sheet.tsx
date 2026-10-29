import { PickerColumn, numberOptions } from '@/shared/components/picker-column';
import { PickerSheet, useDraft } from '@/shared/components/picker-sheet';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { joinMinutes, splitMinutes } from '@/shared/lib/time';
import { useFormatDuration } from '@/shared/lib/use-clock-format';
import { View } from 'react-native';

type DurationPickerSheetProps = {
  visible: boolean;
  title: string;
  /** Minutes: what the platform stores as `deadline_minutes`. */
  value: number;
  /** Called with minutes. Zero is allowed here; the form says it is too short. */
  onConfirm: (minutes: number) => void;
  onClose: () => void;
};

const HOURS = numberOptions(0, 99);
const MINUTES = numberOptions(0, 59);

/** A length of time as hours and minutes, returned as minutes. */
function DurationPickerSheet({
  visible,
  title,
  value,
  onConfirm,
  onClose,
}: DurationPickerSheetProps) {
  const t = useT();
  const formatDuration = useFormatDuration();
  const [draft, setDraft] = useDraft(visible, splitMinutes(value));

  return (
    <PickerSheet
      visible={visible}
      title={title}
      onClose={onClose}
      onConfirm={() => onConfirm(joinMinutes(draft.hours, draft.minutes))}
    >
      <Text
        accessibilityLiveRegion="polite"
        className="font-sans-semibold mb-2 text-center text-[16px]"
      >
        {formatDuration(joinMinutes(draft.hours, draft.minutes))}
      </Text>
      <View className="flex-row gap-2">
        <PickerColumn
          label={t('picker.hours')}
          options={HOURS}
          value={draft.hours}
          onChange={(hours) => setDraft({ ...draft, hours })}
        />
        <PickerColumn
          label={t('picker.minutes')}
          options={MINUTES}
          value={draft.minutes}
          onChange={(minutes) => setDraft({ ...draft, minutes })}
        />
      </View>
    </PickerSheet>
  );
}

export { DurationPickerSheet };
