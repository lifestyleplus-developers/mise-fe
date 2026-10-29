import {
  LOCKING_FAILURES,
  classifyTeamError,
  type TeamFailure,
} from '@/features/assignments/team-errors';
import { useAddMember } from '@/features/assignments/use-members';
import { usePeople } from '@/features/assignments/use-people';
import type { AssignmentRole } from '@/shared/api/types';
import { PeoplePicker } from '@/shared/components/people-picker';
import { format, useT } from '@/shared/i18n';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
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
 * Adds a person to one bucket of a team, from the assignment's candidates:
 * active people not already on it, so nobody here needs greying out.
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
  const [search, setSearch] = React.useState('');
  const people = usePeople(assignmentId, useDebouncedValue(search.trim()));
  const add = useAddMember(assignmentId);
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | undefined>();

  const list = people.data
    ? people.data.pages
        .flatMap((page) => page.results)
        .map((person) => ({
          id: person.id,
          name: person.full_name,
          username: person.username,
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
      loading={people.isPending}
      onSearchChange={setSearch}
      searching={people.isPlaceholderData}
      hasMore={people.hasNextPage}
      loadingMore={people.isFetchingNextPage}
      onLoadMore={() => void people.fetchNextPage()}
      failed={people.isError}
      onRetry={() => void people.refetch()}
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
