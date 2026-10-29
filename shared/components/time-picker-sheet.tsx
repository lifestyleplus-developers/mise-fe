import { PickerColumn, numberOptions } from '@/shared/components/picker-column';
import { PickerSheet, useDraft } from '@/shared/components/picker-sheet';
import { useT } from '@/shared/i18n';
import {
  deviceUses12HourClock,
  parseClock,
  to12Hour,
  to24Hour,
  toClockString,
} from '@/shared/lib/time';
import { View } from 'react-native';

type TimePickerSheetProps = {
  visible: boolean;
  title: string;
  /** HH:MM, 24-hour. */
  value: string;
  /** Called with HH:MM, 24-hour, whatever clock the phone shows. */
  onConfirm: (value: string) => void;
  onClose: () => void;
};

const HOURS_12 = numberOptions(1, 12);
const HOURS_24 = numberOptions(0, 23, true);
const MINUTES = numberOptions(0, 59, true);

/**
 * A time of day, in the clock the phone uses: hour, minute and AM or PM on a
 * 12-hour phone, hour and minute on a 24-hour one. Stored values stay 24-hour.
 */
function TimePickerSheet({
  visible,
  title,
  value,
  onConfirm,
  onClose,
}: TimePickerSheetProps) {
  const t = useT();
  const twelveHour = deviceUses12HourClock();
  const [draft, setDraft] = useDraft(visible, parseClock(value));
  const { hour12, pm } = to12Hour(draft.hour);

  return (
    <PickerSheet
      visible={visible}
      title={title}
      onClose={onClose}
      onConfirm={() => onConfirm(toClockString(draft))}
    >
      <View className="flex-row gap-2">
        {twelveHour ? (
          <PickerColumn
            label={t('picker.hour')}
            options={HOURS_12}
            value={hour12}
            onChange={(next) =>
              setDraft({ ...draft, hour: to24Hour(next, pm) })
            }
          />
        ) : (
          <PickerColumn
            label={t('picker.hour')}
            options={HOURS_24}
            value={draft.hour}
            onChange={(hour) => setDraft({ ...draft, hour })}
          />
        )}
        <PickerColumn
          label={t('picker.minute')}
          options={MINUTES}
          value={draft.minute}
          onChange={(minute) => setDraft({ ...draft, minute })}
        />
        {twelveHour ? (
          <View className="w-20">
            <PickerColumn
              label={`${t('time.am')}/${t('time.pm')}`}
              options={[
                { value: 0, label: t('time.am') },
                { value: 1, label: t('time.pm') },
              ]}
              value={pm ? 1 : 0}
              onChange={(next) =>
                setDraft({ ...draft, hour: to24Hour(hour12, next === 1) })
              }
            />
          </View>
        ) : null}
      </View>
    </PickerSheet>
  );
}

export { TimePickerSheet };
