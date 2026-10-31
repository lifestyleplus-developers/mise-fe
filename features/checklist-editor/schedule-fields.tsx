import {
  checkForm,
  closingTime,
  gapMessage,
  type ScheduleForm,
} from '@/features/checklist-editor/schedule-form';
import { DayOfMonthSheet } from '@/shared/components/day-of-month-sheet';
import { DurationPickerSheet } from '@/shared/components/duration-picker-sheet';
import {
  PickerColumn,
  type PickerColumnOption,
} from '@/shared/components/picker-column';
import { PickerField } from '@/shared/components/picker-field';
import { PickerSheet, useDraft } from '@/shared/components/picker-sheet';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { TimePickerSheet } from '@/shared/components/time-picker-sheet';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { WeekdayChips } from '@/shared/components/weekday-chips';
import { format, useT, type MessageKey } from '@/shared/i18n';
import {
  HOURLY_INTERVALS,
  lastRunChoices,
  runsPerDay,
} from '@/shared/lib/schedule';
import { parseClock, toClockString } from '@/shared/lib/time';
import {
  useFormatClock,
  useFormatDuration,
} from '@/shared/lib/use-clock-format';
import * as React from 'react';
import { View } from 'react-native';

const FREQUENCIES = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;

type Picker = 'time' | 'duration' | 'day' | 'last' | null;

type Recurrence = ScheduleForm['recurrence'];

type ScheduleFieldsProps = {
  form: ScheduleForm;
  /** Which frequencies to offer. Attendance has no Hourly (API Contract §11). */
  frequencies?: readonly Recurrence[];
  /** Overrides the example under the name field. */
  namePlaceholder?: string;
  /** Overrides the line under the frequency choice. */
  rhythmHint?: string;
  /** Drawn between the name and the frequency, e.g. attendance's Method. */
  afterName?: React.ReactNode;
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
    if (form.recurrence === 'HOURLY') {
      return format(
        t(daysLater > 0 ? 'sched.first-closes-next' : 'sched.first-closes'),
        { time: at },
      );
    }
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
  frequencies = FREQUENCIES,
  namePlaceholder,
  rhythmHint,
  afterName,
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
      : problems.short
        ? t('sched.short')
        : problems.overlap || conflict
          ? overlapText
          : undefined;
  const closes = closesText(form);

  return (
    <View className="shadow-card border-border bg-card mx-4 gap-5 rounded-3xl border p-4">
      <View className="gap-1">
        <TextField
          label={t('sched.name')}
          placeholder={namePlaceholder ?? t('sched.name-placeholder')}
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

      {afterName}

      <View className="gap-2">
        <Text className="font-sans-semibold text-[13px]">
          {t('sched.how-often')}
        </Text>
        <SegmentedControl
          label={t('sched.how-often')}
          value={form.recurrence}
          options={frequencies.map((value) => ({
            value,
            label: t(`sched.freq.${value}` as MessageKey),
          }))}
          onChange={(recurrence) => !disabled && onChange({ recurrence })}
        />
        <Text className="text-muted-foreground px-1 text-[12px] leading-snug">
          {rhythmHint ?? t('sched.rhythm-hint')}
        </Text>
      </View>

      {form.recurrence === 'HOURLY' ? (
        <View className="gap-2">
          <Text className="font-sans-semibold text-[13px]">
            {t('sched.every')}
          </Text>
          <SegmentedControl
            label={t('sched.every')}
            value={String(form.interval)}
            options={HOURLY_INTERVALS.map((hours) => ({
              value: String(hours),
              label:
                hours === 1
                  ? t('sched.every-one')
                  : format(t('sched.every-n'), { n: String(hours) }),
            }))}
            onChange={(next) =>
              !disabled && onChange({ interval: Number(next) })
            }
          />
        </View>
      ) : null}

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
        label={t(
          form.recurrence === 'HOURLY' ? 'sched.first-run' : 'sched.opens-at',
        )}
        value={form.start ? formatClock(form.start) : t('sched.choose')}
        disabled={disabled}
        error={submitted && problems.start ? t('sched.required') : undefined}
        onPress={() => setPicker('time')}
      />

      {form.recurrence === 'HOURLY' ? (
        <View className="gap-1">
          <PickerField
            label={t('sched.last-run')}
            value={
              problems.noLater
                ? t('sched.no-later')
                : form.lastRun
                  ? formatClock(form.lastRun)
                  : t('sched.choose')
            }
            disabled={disabled || problems.noLater}
            error={
              problems.noLater
                ? t('sched.earlier')
                : submitted && problems.lastRun
                  ? t('sched.required')
                  : undefined
            }
            onPress={() => setPicker('last')}
          />
        </View>
      ) : null}

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
        title={t(
          form.recurrence === 'HOURLY' ? 'sched.first-run' : 'sched.opens-at',
        )}
        value={form.start ?? '06:00'}
        onClose={() => setPicker(null)}
        onConfirm={(start) => {
          setPicker(null);
          onChange({ start });
        }}
      />
      <LastRunSheet
        visible={picker === 'last'}
        title={t('sched.last-run')}
        form={form}
        onClose={() => setPicker(null)}
        onConfirm={(lastRun) => {
          setPicker(null);
          onChange({ lastRun });
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

/** The times an hourly checklist can end on: every interval after its first run. */
function LastRunSheet({
  visible,
  title,
  form,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  form: ScheduleForm;
  onClose: () => void;
  onConfirm: (lastRun: string) => void;
}) {
  const formatClock = useFormatClock();
  const start = form.start ? parseClock(form.start) : null;
  const choices = start
    ? lastRunChoices(start.hour * 60 + start.minute, form.interval)
    : [];
  const clock = (minutes: number) =>
    toClockString({ hour: Math.floor(minutes / 60), minute: minutes % 60 });
  const options: PickerColumnOption[] = choices.map((minutes) => ({
    value: minutes,
    label: formatClock(clock(minutes)),
  }));
  const current = form.lastRun ? parseClock(form.lastRun) : null;
  const [draft, setDraft] = useDraft(
    visible,
    current ? current.hour * 60 + current.minute : (choices[0] ?? 0),
  );

  return (
    <PickerSheet
      visible={visible}
      title={title}
      onClose={onClose}
      onConfirm={() =>
        options.length > 0 ? onConfirm(clock(draft)) : onClose()
      }
    >
      <PickerColumn
        label={title}
        options={options}
        value={draft}
        onChange={setDraft}
      />
    </PickerSheet>
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
    problems.short ||
    problems.overlap ||
    problems.days ||
    problems.noLater ||
    (form.recurrence === 'HOURLY' && form.lastRun === null) ||
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

  const first = parseClock(form.start);
  const last = form.lastRun ? parseClock(form.lastRun) : null;
  const text =
    form.recurrence === 'HOURLY' && last
      ? format(
          t(
            form.interval === 1 ? 'sched.sum.hourly-one' : 'sched.sum.hourly-n',
          ),
          {
            first: open,
            last: formatClock(form.lastRun ?? form.start),
            n: String(
              runsPerDay(
                first.hour * 60 + first.minute,
                last.hour * 60 + last.minute,
                form.interval,
              ),
            ),
            e: String(form.interval),
            dur: formatDuration(form.window),
          },
        )
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
