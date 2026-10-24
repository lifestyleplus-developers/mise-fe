import type { Checklist, CreateChecklistRequest } from '@/shared/api/types';
import type { MessageKey } from '@/shared/i18n';
import {
  MIN_WINDOW_MINUTES,
  lastRunChoices,
  runGapMinutes,
  windowOverlapsNextRun,
} from '@/shared/lib/schedule';
import { parseClock, toClockString } from '@/shared/lib/time';

/** The editor's form. Times and the window stay null until someone chooses them. */
export type ScheduleForm = {
  name: string;
  recurrence: Checklist['recurrence'];
  /** HH:MM, 24-hour. For an hourly checklist, the first run of the day. */
  start: string | null;
  /** Minutes. */
  window: number | null;
  /** WEEKLY only; 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  /** MONTHLY only. */
  day: number;
  /** HOURLY only: a run every this many hours. */
  interval: number;
  /** HOURLY only: HH:MM, the last run of the day. Null until chosen. */
  lastRun: string | null;
};

export const EMPTY_FORM: ScheduleForm = {
  name: '',
  recurrence: 'DAILY',
  start: null,
  window: null,
  weekdays: [],
  day: 1,
  interval: 1,
  lastRun: null,
};

export function formFromChecklist(checklist: Checklist): ScheduleForm {
  return {
    name: checklist.name,
    recurrence: checklist.recurrence,
    start: checklist.st_time,
    window: checklist.deadline_minutes,
    weekdays: [...(checklist.weekdays ?? [])].sort((a, b) => a - b),
    day: checklist.day_of_month ?? 1,
    interval: checklist.interval_hours ?? 1,
    lastRun: checklist.last_run_time,
  };
}

/**
 * The form as the platform would hold it: values that do not belong to the chosen
 * frequency are dropped. Compare forms through this, so switching to Weekly, picking
 * a day and switching back does not read as a change.
 */
export function normalizeForm(form: ScheduleForm): ScheduleForm {
  const hourly = form.recurrence === 'HOURLY';
  return {
    ...form,
    weekdays:
      form.recurrence === 'WEEKLY'
        ? [...form.weekdays].sort((a, b) => a - b)
        : [],
    day: form.recurrence === 'MONTHLY' ? form.day : 1,
    interval: hourly ? form.interval : 1,
    lastRun: hourly ? form.lastRun : null,
  };
}

/**
 * What goes to the platform. Values that do not belong to the chosen frequency are
 * sent as null, not left over from an earlier choice. Only call this on a form that
 * passed `checkForm`.
 */
export function toRequest(form: ScheduleForm): CreateChecklistRequest {
  const hourly = form.recurrence === 'HOURLY';
  return {
    name: form.name.trim(),
    recurrence: form.recurrence,
    st_time: form.start ?? '',
    deadline_minutes: form.window ?? 0,
    weekdays: form.recurrence === 'WEEKLY' ? form.weekdays : null,
    day_of_month: form.recurrence === 'MONTHLY' ? form.day : null,
    interval_hours: hourly ? form.interval : null,
    last_run_time: hourly ? form.lastRun : null,
  };
}

const minutesOf = (value: string) => {
  const { hour, minute } = parseClock(value);
  return hour * 60 + minute;
};

/**
 * Keeps a last run honest after the first run or the interval changes: it must still
 * be one of the times the schedule can end on, or it is cleared and chosen again.
 */
export function withValidLastRun(form: ScheduleForm): ScheduleForm {
  if (form.recurrence !== 'HOURLY' || form.lastRun === null) return form;
  const stillRuns =
    form.start !== null &&
    lastRunChoices(minutesOf(form.start), form.interval).includes(
      minutesOf(form.lastRun),
    );
  return stillRuns ? form : { ...form, lastRun: null };
}

export type FormProblems = {
  name: boolean;
  start: boolean;
  window: boolean;
  days: boolean;
  /** An hourly checklist with no last run chosen. */
  lastRun: boolean;
  /** An hourly first run so late that no other run fits today. */
  noLater: boolean;
  /** A window under the platform's minimum, 0 included. */
  short: boolean;
  /** A window longer than the gap to the next run. */
  overlap: boolean;
};

export function checkForm(form: ScheduleForm): FormProblems {
  const noDays = form.recurrence === 'WEEKLY' && form.weekdays.length === 0;
  const hourly = form.recurrence === 'HOURLY';
  const window = form.window;
  const noLater =
    hourly &&
    form.start !== null &&
    lastRunChoices(minutesOf(form.start), form.interval).length === 0;
  return {
    name: !form.name.trim(),
    start: form.start === null,
    window: window === null,
    days: noDays,
    lastRun: hourly && form.lastRun === null && !noLater,
    noLater,
    short: window !== null && window < MIN_WINDOW_MINUTES,
    // With no days chosen there is no gap to measure; "pick a day" comes first.
    overlap:
      window !== null &&
      window >= MIN_WINDOW_MINUTES &&
      !noDays &&
      windowOverlapsNextRun(
        form.recurrence,
        form.weekdays,
        window,
        form.interval,
      ),
  };
}

export const hasProblems = (problems: FormProblems) =>
  Object.values(problems).some(Boolean);

/** The gap to the next run, as the words the overlap message wants. */
export function gapMessage(form: ScheduleForm): {
  key: MessageKey;
  n?: number;
} {
  switch (form.recurrence) {
    case 'HOURLY':
      return form.interval === 1
        ? { key: 'sched.gap.hour' }
        : { key: 'sched.gap.hours', n: form.interval };
    case 'DAILY':
      return { key: 'sched.gap.day' };
    case 'MONTHLY':
      return { key: 'sched.gap.month' };
    case 'WEEKLY': {
      const days = runGapMinutes('WEEKLY', form.weekdays) / (24 * 60);
      return days === 1
        ? { key: 'sched.gap.week-one' }
        : { key: 'sched.gap.week-n', n: days };
    }
  }
}

/** When a window that opens at `start` closes: the clock time and how many days on. */
export function closingTime(
  start: string,
  windowMinutes: number,
): { time: string; daysLater: number } {
  const { hour, minute } = parseClock(start);
  const total = hour * 60 + minute + windowMinutes;
  const daysLater = Math.floor(total / (24 * 60));
  const inDay = total % (24 * 60);
  return {
    time: toClockString({ hour: Math.floor(inDay / 60), minute: inDay % 60 }),
    daysLater,
  };
}
