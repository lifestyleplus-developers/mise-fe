import {
  EMPTY_FORM,
  normalizeForm,
  type ScheduleForm,
} from '@/features/checklist-editor/schedule-form';
import type {
  AttendanceConfig,
  CreateAttendanceConfigRequest,
  UpdateAttendanceConfigRequest,
} from '@/shared/api/types';

export { EMPTY_FORM, normalizeForm };
export type { ScheduleForm };

/** Attendance repeats daily, weekly or monthly; never hourly (API Contract §11). */
export const CONFIG_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

/**
 * A configuration is a schedule with a name, so its editor is the checklist's:
 * the same form, with the hourly parts left at their defaults.
 */
export function formFromConfig(config: AttendanceConfig): ScheduleForm {
  return {
    ...EMPTY_FORM,
    name: config.name,
    recurrence: config.recurrence,
    start: config.st_time,
    window: config.deadline_minutes,
    weekdays: [...(config.weekdays ?? [])].sort((a, b) => a - b),
    day: config.day_of_month ?? 1,
  };
}

/**
 * What goes to the platform. Days belong to Weekly and a day of the month to
 * Monthly; the others are sent as null, not left over from an earlier choice.
 * Only call this on a form that passed `checkForm`.
 */
export function toConfigRequest(
  form: ScheduleForm,
): Omit<CreateAttendanceConfigRequest, 'outlet_id'> &
  UpdateAttendanceConfigRequest {
  return {
    name: form.name.trim(),
    method: 'MANUAL',
    recurrence: form.recurrence as AttendanceConfig['recurrence'],
    st_time: form.start ?? '',
    deadline_minutes: form.window ?? 0,
    weekdays: form.recurrence === 'WEEKLY' ? form.weekdays : null,
    day_of_month: form.recurrence === 'MONTHLY' ? form.day : null,
  };
}
