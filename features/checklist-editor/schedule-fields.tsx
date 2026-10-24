import {
  checkForm,
  closingTime,
  gapMessage,
  type ScheduleForm,
} from '@/features/checklist-editor/schedule-form';
import { DayOfMonthSheet } from '@/shared/components/day-of-month-sheet';
import { DurationPickerSheet } from '@/shared/components/duration-picker-sheet';
import { PickerField } from '@/shared/components/picker-field';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { TimePickerSheet } from '@/shared/components/time-picker-sheet';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { WeekdayChips } from '@/shared/components/weekday-chips';
import { format, useT, type MessageKey } from '@/shared/i18n';
import {
  useFormatClock,
  useFormatDuration,
} from '@/shared/lib/use-clock-format';
import * as React from 'react';
import { View } from 'react-native';

const FREQUENCIES = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;

type Picker = 'time' | 'duration' | 'day' | null;

type ScheduleFieldsProps = {
  form: ScheduleForm;
  onChange: (patch: Partial<ScheduleForm>) => void;
  /** Save was tapped: required fields now say so. */
  submitted: boolean;
  /** The platform said the window runs into the next run. */
  conflict: boolean;
  disabled: boolean;
};

/** "closes at" in words: the time, and how many days on if it is not today. */
function useClosesText() {
  const t = useT();
  const formatClock = useFormatClock();
  return (form: ScheduleForm): string | null => {
    if (form.start === null || form.window === null || form.window <= 0) {
      return null;
    }
    const { time, daysLater } = closingTime(form.start, form.window);
    const at = formatClock(time);
    if (form.window >= 24 * 60) {
      return format(
        t(daysLater === 1 ? 'sched.closes-later-one' : 'sched.closes-later-n'),
        { n: String(daysLater), time: at },
      );
    }
    return format(t(daysLater > 0 ? 'sched.closes-next' : 'sched.closes'), {
      time: at,
    });
  };
}

/** The editor's form card: name, how often, when it opens, how long it stays open. */
function ScheduleFields({
  form,
  onChange,
  submitted,
  conflict,
  disabled,
}: ScheduleFieldsProps) {
  const t = useT();
  const formatClock = useFormatClock();
  const formatDuration = useFormatDuration();
  const closesText = useClosesText();
  const [picker, setPicker] = React.useState<Picker>(null);
  const [daysTouched, setDaysTouched] = React.useState(false);

  const problems = checkForm(form);
  const gap = gapMessage(form);
  const overlapText = format(t('sched.overlap'), {
    gap: format(t(gap.key), { n: String(gap.n ?? '') }),
  });

  const windowError =
    submitted && problems.window
      ? t('sched.required')
      : problems.zero
        ? t('sched.zero')
        : problems.overlap || conflict
          ? overlapText
          : undefined;
  const closes = closesText(form);

  return (
    <View className="shadow-card border-border bg-card mx-4 gap-5 rounded-3xl border p-4">
      <View className="gap-1">
        <TextField
          label={t('sched.name')}
          placeholder={t('sched.name-placeholder')}
          value={form.name}
          editable={!disabled}
          multiline
          aria-invalid={submitted && problems.name}
          className="h-auto min-h-12 py-3"
          onChangeText={(name) =>
            onChange({ name: name.replace(/[\r\n]+/g, ' ') })
          }
        />
        {submitted && problems.name ? (
          <ErrorText>{t('sched.required')}</ErrorText>
        ) : null}
      </View>

      <View className="gap-2">
        <Text className="font-sans-semibold text-[13px]">
          {t('sched.how-often')}
        </Text>
        <SegmentedControl
          label={t('sched.how-often')}
          value={form.recurrence}
          options={FREQUENCIES.map((value) => ({
            value,
            label: t(`sched.freq.${value}` as MessageKey),
          }))}
          onChange={(recurrence) => !disabled && onChange({ recurrence })}
        />
        <Text className="text-muted-foreground px-1 text-[12px] leading-snug">
          {t('sched.rhythm-hint')}
        </Text>
      </View>

      {form.recurrence === 'WEEKLY' ? (
        <View className="gap-2">
          <Text className="font-sans-semibold text-[13px]">
            {t('sched.days')}
          </Text>
          <WeekdayChips
            label={t('sched.days')}
            value={form.weekdays}
            disabled={disabled}
            error={
              (submitted || daysTouched) && problems.days
                ? t('sched.pick-day')
                : undefined
            }
            onChange={(weekdays) => {
              setDaysTouched(true);
              onChange({ weekdays });
            }}
          />
        </View>
      ) : null}

      {form.recurrence === 'MONTHLY' ? (
        <View className="gap-1">
          <PickerField
            label={t('sched.day-of-month')}
            value={format(t('picker.day-n'), { n: String(form.day) })}
            disabled={disabled}
            onPress={() => setPicker('day')}
          />
          {form.day >= 29 ? (
            <Text className="px-1 text-right text-[12px] leading-snug">
              {t('sched.short-month')}
            </Text>
          ) : null}
        </View>
      ) : null}

      <PickerField
        label={t('sched.opens-at')}
        value={form.start ? formatClock(form.start) : t('sched.choose')}
        disabled={disabled}
        error={submitted && problems.start ? t('sched.required') : undefined}
        onPress={() => setPicker('time')}
      />

      <View className="gap-1">
        <PickerField
          label={t('sched.open-for')}
          value={
            form.window === null
              ? t('sched.choose')
              : formatDuration(form.window)
          }
          disabled={disabled}
          error={windowError}
          onPress={() => setPicker('duration')}
        />
        {closes ? (
          <Text className="px-1 text-right text-[13px] leading-snug">
            {closes}
          </Text>
        ) : null}
      </View>

      <TimePickerSheet
        visible={picker === 'time'}
        title={t('sched.opens-at')}
        value={form.start ?? '06:00'}
        onClose={() => setPicker(null)}
        onConfirm={(start) => {
          setPicker(null);
          onChange({ start });
        }}
      />
      <DurationPickerSheet
        visible={picker === 'duration'}
        title={t('sched.open-for')}
        value={form.window ?? 60}
        onClose={() => setPicker(null)}
        onConfirm={(window) => {
          setPicker(null);
          onChange({ window });
        }}
      />
      <DayOfMonthSheet
        visible={picker === 'day'}
        title={t('sched.day-of-month')}
        value={form.day}
        onClose={() => setPicker(null)}
        onConfirm={(day) => {
          setPicker(null);
          onChange({ day });
        }}
      />
    </View>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="alert"
      className="text-destructive-soft-foreground px-1 text-[13px]"
    >
      {children}
    </Text>
  );
}

/** One line saying what the schedule means, once it is complete and sound. */
function ScheduleSummary({
  form,
  conflict,
}: {
  form: ScheduleForm;
  conflict: boolean;
}) {
  const t = useT();
  const formatClock = useFormatClock();
  const formatDuration = useFormatDuration();
  const problems = checkForm(form);

  if (
    form.start === null ||
    form.window === null ||
    problems.zero ||
    problems.overlap ||
    problems.days ||
    conflict
  ) {
    return null;
  }

  const open = formatClock(form.start);
  const { time, daysLater } = closingTime(form.start, form.window);
  const at = formatClock(time);
  const close =
    form.window >= 24 * 60
      ? format(t(daysLater === 1 ? 'sched.later-one' : 'sched.later-n'), {
          n: String(daysLater),
          time: at,
        })
      : daysLater > 0
        ? format(t('sched.next-day'), { time: at })
        : at;

  const names = [...form.weekdays]
    .sort((a, b) => a - b)
    .map((day) => t(`wd-full.${day}` as MessageKey));
  const days =
    names.length <= 1
      ? names.join('')
      : `${names.slice(0, -1).join(', ')} ${t('sched.and')} ${names[names.length - 1]}`;

  const text =
    form.recurrence === 'HOURLY'
      ? format(t('sched.sum.hourly'), {
          open,
          dur: formatDuration(form.window),
        })
      : form.recurrence === 'DAILY'
        ? format(t('sched.sum.daily'), { open, close })
        : form.recurrence === 'WEEKLY'
          ? format(t('sched.sum.weekly'), { days, open, close })
          : format(
              t(
                form.day >= 29 ? 'sched.sum.monthly-last' : 'sched.sum.monthly',
              ),
              { n: String(form.day), open, close },
            );

  return (
    <Text
      accessibilityLiveRegion="polite"
      className="font-sans-medium mx-4 mt-3 px-1 text-[14px] leading-snug"
    >
      {text}
    </Text>
  );
}

export { ScheduleFields, ScheduleSummary };
