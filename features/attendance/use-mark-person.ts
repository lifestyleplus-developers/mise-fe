import { useMutation } from '@tanstack/react-query';

import { useMe } from '@/features/auth/use-me';
import { api } from '@/shared/api/client';
import { queryClient } from '@/shared/api/query-client';
import { ApiError } from '@/shared/api/http';
import { useQueuedWrites } from '@/shared/api/query-helpers';
import type {
  AttendanceMark,
  AttendanceSessionDetail,
  MarkPersonRequest,
} from '@/shared/api/types';

import { attendanceKeys } from './attendance-keys';
import { countMarks } from './counts';

export type MarkVariables = {
  sessionId: number;
  markId: number;
  request: MarkPersonRequest;
};

const MARK_KEY = ['attendance', 'mark'] as const;

/**
 * PATCH /attendance/marks/{id} — its defaults, so a paused (queued) mark can be
 * replayed after the app restarts (AGENTS.md: setMutationDefaults at the point
 * the mutation is defined).
 */
const markMutationFn = ({
  markId,
  request,
}: MarkVariables): Promise<AttendanceMark> =>
  api.attendance.mark(markId, request);

queryClient.setMutationDefaults(MARK_KEY, { mutationFn: markMutationFn });

function writeMark(
  sessionId: number,
  markId: number,
  update: (mark: AttendanceMark) => AttendanceMark,
) {
  queryClient.setQueryData<AttendanceSessionDetail>(
    attendanceKeys.session(sessionId),
    (session) => {
      if (!session) return session;
      const marks = session.marks.map((mark) =>
        mark.id === markId ? update(mark) : mark,
      );
      return { ...session, marks, counts: countMarks(marks) };
    },
  );
}

/**
 * Marking, one person at a time, written as it is given (§11). The row shows the
 * mark at once and the counts follow, so "saved as you go" is true. A write that
 * cannot reach the platform stays queued; one it refuses is rolled back and read
 * from `useMarkQueue`.
 */
export function useMarkPerson() {
  const me = useMe().data;
  return useMutation<
    AttendanceMark,
    Error,
    MarkVariables,
    { previous: AttendanceSessionDetail | undefined }
  >({
    mutationKey: MARK_KEY,
    networkMode: 'online',
    mutationFn: markMutationFn,
    onMutate: async ({ sessionId, markId, request }) => {
      await queryClient.cancelQueries({
        queryKey: attendanceKeys.session(sessionId),
      });
      const previous = queryClient.getQueryData<AttendanceSessionDetail>(
        attendanceKeys.session(sessionId),
      );
      const now = new Date().toISOString();
      writeMark(sessionId, markId, (mark) => ({
        ...mark,
        status: request.status,
        source: 'MANUAL',
        note: request.note === undefined ? mark.note : request.note,
        marked_by: me
          ? { id: me.user.id, full_name: me.user.full_name }
          : mark.marked_by,
        marked_at: now,
        changes:
          mark.status !== 'UNMARKED' && mark.status !== request.status
            ? [
                ...mark.changes,
                {
                  from_status: mark.status,
                  to_status: request.status,
                  changed_by: me?.user.id ?? 0,
                  changed_at: now,
                },
              ]
            : mark.changes,
      }));
      return { previous };
    },
    onError: (error, { sessionId }, context) => {
      // Only a refusal is rolled back. A write that never arrived stays on the
      // row as it was marked, waiting to send.
      if (error instanceof ApiError && context?.previous) {
        queryClient.setQueryData(
          attendanceKeys.session(sessionId),
          context.previous,
        );
      }
    },
    onSuccess: (mark, { sessionId, markId }) => {
      writeMark(sessionId, markId, () => mark);
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.sessionLists,
      });
    },
  });
}

/**
 * Marks of one session that have not landed, by mark id. `waiting` is "Waiting
 * to send"; `refused` carries the platform's answer, and for
 * `window_closed` the screen says "Not recorded" (FE Spec §6).
 */
export function useMarkQueue(sessionId: number) {
  const writes = useQueuedWrites<MarkVariables>(MARK_KEY, (v) =>
    String(v.markId),
  );
  return new Map(
    writes
      .filter((write) => write.variables.sessionId === sessionId)
      .map((write) => [write.variables.markId, write] as const),
  );
}
