import type { AttendanceCounts, AttendanceMark } from '@/shared/api/types';

/**
 * A session's counts from its marks, the way the platform does: a manager saying
 * absent (`not_present`) is told apart from nobody having checked (`not_marked`).
 */
export function countMarks(marks: AttendanceMark[]): AttendanceCounts {
  const count = (test: (mark: AttendanceMark) => boolean) =>
    marks.filter(test).length;
  return {
    total: marks.length,
    present: count((m) => m.status === 'PRESENT'),
    not_present: count(
      (m) => m.status === 'NOT_PRESENT' && m.source !== 'SYSTEM',
    ),
    not_marked: count(
      (m) => m.status === 'NOT_PRESENT' && m.source === 'SYSTEM',
    ),
    needs_review: count((m) => m.status === 'NEEDS_REVIEW'),
    unmarked: count((m) => m.status === 'UNMARKED'),
  };
}
