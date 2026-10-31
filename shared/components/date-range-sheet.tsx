import { PickerColumn, numberOptions } from '@/shared/components/picker-column';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { OptionList } from '@/shared/components/option-list';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import {
  daysInMonth,
  formatDay,
  fromDay,
  isRangeValid,
  monthName,
  rangeFor,
  toDay,
  type DateRange,
  type RangePreset,
} from '@/shared/lib/date-range';
import { cn } from '@/shared/lib/utils';
import { useLanguageStore } from '@/shared/stores/language-store';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type NamedPreset = Exclude<RangePreset, 'custom'>;

type DateRangeSheetProps = {
  visible: boolean;
  value: DateRange;
  /** A named range applies at once; Choose dates applies on Done. */
  onChange: (range: DateRange) => void;
  onClose: () => void;
  /** Which named rows to offer, in order. Choose dates is always last. */
  presets?: readonly NamedPreset[];
};

const DEFAULT_PRESETS: readonly NamedPreset[] = ['today', 'last7', 'last30'];

const PRESET_LABEL = {
  today: 'range.today',
  yesterday: 'range.yesterday',
  last7: 'range.last-7',
  last30: 'range.last-30',
} as const;

type Field = 'from' | 'to';

/**
 * The date range every report and log filters by: Today, Last 7 days, Last 30
 * days, or Choose dates. In Choose dates, To cannot be before From (Done stays
 * off until it is not) and nothing past today can be picked.
 */
function DateRangeSheet({
  visible,
  value,
  onChange,
  onClose,
  presets = DEFAULT_PRESETS,
}: DateRangeSheetProps) {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const [custom, setCustom] = React.useState(false);
  const [draft, setDraft] = React.useState({ from: value.from, to: value.to });
  const [editing, setEditing] = React.useState<Field>('from');

  // Each opening starts from the saved range, on the list of named ranges.
  const [wasVisible, setWasVisible] = React.useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setCustom(false);
      setDraft({ from: value.from, to: value.to });
      setEditing('from');
    }
  }

  const valid = isRangeValid(draft.from, draft.to);

  if (!custom) {
    return (
      <BottomSheet
        visible={visible}
        title={t('range.title')}
        onDismiss={onClose}
        footer={
          <Button variant="outline" className="w-full" onPress={onClose}>
            <Text>{t('admin.cancel')}</Text>
          </Button>
        }
      >
        <OptionList<RangePreset>
          value={value.preset}
          options={[
            ...presets.map((preset) => ({
              value: preset as RangePreset,
              label: t(PRESET_LABEL[preset]),
            })),
            { value: 'custom', label: t('range.choose') },
          ]}
          onChange={(preset) => {
            if (preset === 'custom') {
              setCustom(true);
              return;
            }
            onChange(rangeFor(preset));
            onClose();
          }}
        />
      </BottomSheet>
    );
  }

  const today = new Date();
  const year = fromDay(draft[editing]).getFullYear();
  const month = fromDay(draft[editing]).getMonth() + 1;
  const day = fromDay(draft[editing]).getDate();

  function setPart(part: 'day' | 'month' | 'year', next: number) {
    const parts = { year, month, day, [part]: next };
    const clamped = Math.min(parts.day, daysInMonth(parts.year, parts.month));
    let picked = new Date(parts.year, parts.month - 1, clamped);
    if (picked.getTime() > today.getTime()) picked = today;
    setDraft((current) => ({ ...current, [editing]: toDay(picked) }));
  }

  const thisYear = today.getFullYear();
  const lastMonth = year === thisYear ? today.getMonth() + 1 : 12;

  return (
    <BottomSheet
      visible={visible}
      title={t('range.choose')}
      onDismiss={onClose}
      footer={
        <View className="gap-2">
          <Button
            className="w-full"
            disabled={!valid}
            onPress={() => {
              onChange({ preset: 'custom', ...draft });
              onClose();
            }}
          >
            <Text>{t('picker.done')}</Text>
          </Button>
          <Button variant="outline" className="w-full" onPress={onClose}>
            <Text>{t('admin.cancel')}</Text>
          </Button>
        </View>
      }
    >
      <View className="gap-3">
        <View accessibilityRole="radiogroup" className="flex-row gap-2">
          {(['from', 'to'] as const).map((field) => {
            const selected = field === editing;
            const shown = formatDay(draft[field], language);
            return (
              <Pressable
                key={field}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${t(field === 'from' ? 'range.from' : 'range.to')}, ${shown}`}
                onPress={() => setEditing(field)}
                className={cn(
                  'min-h-14 min-w-0 flex-1 justify-center rounded-2xl border px-4 py-2',
                  selected
                    ? 'border-primary bg-accent'
                    : 'border-input-edge bg-card',
                  !valid && field === 'to' && 'border-destructive',
                )}
              >
                <Text className="text-muted-foreground text-[12px]">
                  {t(field === 'from' ? 'range.from' : 'range.to')}
                </Text>
                <Text className="font-sans-semibold text-[16px]">{shown}</Text>
              </Pressable>
            );
          })}
        </View>

        {!valid ? (
          <Text
            accessibilityRole="alert"
            className="text-destructive text-[14px]"
          >
            {t('range.bad')}
          </Text>
        ) : null}

        {/* Remounted per field so each opens scrolled to its own value. */}
        <View key={editing} className="flex-row gap-2">
          <PickerColumn
            label={t('range.day')}
            options={numberOptions(1, daysInMonth(year, month))}
            value={day}
            onChange={(next) => setPart('day', next)}
          />
          <PickerColumn
            label={t('range.month')}
            options={Array.from({ length: lastMonth }, (_, index) => ({
              value: index + 1,
              label: monthName(index + 1, language),
            }))}
            value={month}
            onChange={(next) => setPart('month', next)}
          />
          <PickerColumn
            label={t('range.year')}
            options={numberOptions(thisYear - 3, thisYear)}
            value={year}
            onChange={(next) => setPart('year', next)}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

/** The range as a short phrase: "Today", "Last 7 days", or "14 Oct to 16 Oct". */
function useRangeLabel() {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  return React.useCallback(
    (range: DateRange): string => {
      if (range.preset !== 'custom') return t(PRESET_LABEL[range.preset]);
      if (range.from === range.to) return formatDay(range.from, language);
      return format(t('range.span'), {
        from: formatDay(range.from, language),
        to: formatDay(range.to, language),
      });
    },
    [t, language],
  );
}

export { DateRangeSheet, useRangeLabel };
export type { DateRangeSheetProps };
