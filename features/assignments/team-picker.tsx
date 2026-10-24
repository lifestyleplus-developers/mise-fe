import {
  LOCKING_FAILURES,
  classifyTeamError,
  type TeamFailure,
} from '@/features/assignments/team-errors';
import { useAddMember, useMembers } from '@/features/assignments/use-members';
import { usePeople } from '@/features/assignments/use-people';
import type { AssignmentRole } from '@/shared/api/types';
import { PeoplePicker } from '@/shared/components/people-picker';
import { format, useT } from '@/shared/i18n';
import * as React from 'react';

type TeamPickerProps = {
  assignmentId: number;
  /** Which bucket the person is being added to. */
  role: AssignmentRole;
  title: string;
  /** The caller is an ADMIN or OWNER, which decides how a refusal reads. */
  viewerIsAdmin: boolean;
  onClose: () => void;
  /** The person was added. */
  onAdded?: (name: string) => void;
  /** The change cannot go on: the picker closes and the screen says why. */
  onLocked?: (failure: TeamFailure) => void;
};

/**
 * Adds a person to one bucket of a team, from everyone in the business.
 * Anyone already on the assignment, in either role, is greyed out with why.
 */
function TeamPicker({
  assignmentId,
  role,
  title,
  viewerIsAdmin,
  onClose,
  onAdded,
  onLocked,
}: TeamPickerProps) {
  const t = useT();
  const people = usePeople();
  const members = useMembers(assignmentId);
  const add = useAddMember(assignmentId);
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | undefined>();

  const reasonFor = (userId: number, active: boolean): string | undefined => {
    const member = members.data?.find((m) => m.user_id === userId);
    if (member) {
      if (member.role === role) {
        return t(
          role === 'CL_ADMIN'
            ? 'team.reason-manager'
            : 'team.reason-already-member',
        );
      }
      return t(
        member.role === 'CL_ADMIN'
          ? 'team.reason-here-manager'
          : 'team.reason-member',
      );
    }
    return active ? undefined : t('people.inactive');
  };

  const list =
    people.data && members.data
      ? people.data.results.map((person) => ({
          id: person.id,
          name: person.full_name,
          username: person.username,
          disabledReason: reasonFor(person.id, person.is_active),
        }))
      : undefined;

  function textFor(failure: TeamFailure, name: string): string {
    switch (failure) {
      case 'conflict':
        return format(t('team.conflict'), { name });
      case 'serverError':
        return t('team.server-error');
      case 'forbiddenManager':
        return t('team.forbidden-manager');
      default:
        return t('out.save-failed');
    }
  }

  return (
    <PeoplePicker
      visible
      title={title}
      people={list}
      loading={people.isPending || members.isPending}
      failed={people.isError || members.isError}
      onRetry={() => {
        void people.refetch();
        void members.refetch();
      }}
      pendingId={pendingId}
      error={error}
      noResultMessage={(name) => format(t('team.no-result'), { name })}
      onClose={onClose}
      onPick={(person) => {
        setError(undefined);
        setPendingId(person.id);
        add.mutate(
          { userId: person.id, role },
          {
            onSuccess: () => {
              onAdded?.(person.name);
              onClose();
            },
            onError: (cause) => {
              setPendingId(null);
              const failure = classifyTeamError(cause, { role, viewerIsAdmin });
              if (LOCKING_FAILURES.includes(failure)) {
                onClose();
                onLocked?.(failure);
              } else {
                setError(textFor(failure, person.name));
              }
            },
          },
        );
      }}
    />
  );
}

export { TeamPicker };
