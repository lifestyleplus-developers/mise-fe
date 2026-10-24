import type { Checklist, CreateChecklistRequest } from '@/shared/api/types';
import type { MessageKey } from '@/shared/i18n';
import { parseClock, toClockString } from '@/shared/lib/time';
import { runGapMinutes, windowOverlapsNextRun } from '@/shared/lib/schedule';

/** The editor's form. Times and the window stay null until someone chooses them. */
export type ScheduleForm = {
  name: string;
  recurrence: Checklist['recurrence'];
  /** HH:MM, 24-hour. */
  start: string | null;
  /** Minutes. */
  window: number | null;
  /** WEEKLY only; 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  /** MONTHLY only. */
  day: number;
};

export const EMPTY_FORM: ScheduleForm = {
  name: '',
  recurrence: 'DAILY',
  start: null,
  window: null,
  weekdays: [],
  day: 1,
};

export function formFromChecklist(checklist: Checklist): ScheduleForm {
  return {
    name: checklist.name,
    recurrence: checklist.recurrence,
    start: checklist.st_time,
    window: checklist.deadline_minutes,
    weekdays: [...(checklist.weekdays ?? [])].sort((a, b) => a - b),
    day: checklist.day_of_month ?? 1,
  };
}

/**
 * The form as the platform would hold it: days that do not belong to the
 * chosen frequency are dropped. Compare forms through this, so switching to
 * Weekly, picking a day and switching back does not read as a change.
 */
export function normalizeForm(form: ScheduleForm): ScheduleForm {
  return {
    ...form,
    weekdays:
      form.recurrence === 'WEEKLY'
        ? [...form.weekdays].sort((a, b) => a - b)
        : [],
    day: form.recurrence === 'MONTHLY' ? form.day : 1,
  };
}

/**
 * What goes to the platform. Days that do not belong to the chosen frequency
 * are sent as null, not left over from an earlier choice. Only call this on a
 * form that passed `checkForm`.
 */
export function toRequest(form: ScheduleForm): CreateChecklistRequest {
  return {
    name: form.name.trim(),
    recurrence: form.recurrence,
    st_time: form.start ?? '',
    deadline_minutes: form.window ?? 0,
    weekdays: form.recurrence === 'WEEKLY' ? form.weekdays : null,
    day_of_month: form.recurrence === 'MONTHLY' ? form.day : null,
  };
}

export type FormProblems = {
  name: boolean;
  start: boolean;
  window: boolean;
  days: boolean;
  /** A window of 0 minutes. */
  zero: boolean;
  /** A window as long as, or longer than, the gap to the next run. */
  overlap: boolean;
};

export function checkForm(form: ScheduleForm): FormProblems {
  const noDays = form.recurrence === 'WEEKLY' && form.weekdays.length === 0;
  const window = form.window;
  return {
    name: !form.name.trim(),
    start: form.start === null,
    window: window === null,
    days: noDays,
    zero: window === 0,
    // With no days chosen there is no gap to measure; "pick a day" comes first.
    overlap:
      window !== null &&
      window > 0 &&
      !noDays &&
      windowOverlapsNextRun(form.recurrence, form.weekdays, window),
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
      return { key: 'sched.gap.hour' };
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
