import { useAddMember, useMembers } from '@/features/assignments/use-members';
import { usePeople } from '@/features/assignments/use-people';
import { PeoplePicker } from '@/shared/components/people-picker';
import { format, useT } from '@/shared/i18n';
import * as React from 'react';

type ManagerPickerProps = {
  assignmentId: number;
  outletName: string;
  onClose: () => void;
};

/** Names a Checklist Manager for one outlet from everyone in the business. */
function ManagerPicker({
  assignmentId,
  outletName,
  onClose,
}: ManagerPickerProps) {
  const t = useT();
  const people = usePeople();
  const members = useMembers(assignmentId);
  const add = useAddMember(assignmentId);
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | undefined>();

  // Anyone already on this assignment, in either role, cannot be named again.
  const reasonFor = (userId: number, active: boolean): string | undefined => {
    const member = members.data?.find((m) => m.user_id === userId);
    if (member) {
      return member.role === 'CL_ADMIN'
        ? t('team.reason-manager')
        : t('team.reason-member');
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

  return (
    <PeoplePicker
      visible
      title={format(t('out.pick-manager'), { outlet: outletName })}
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
          { userId: person.id, role: 'CL_ADMIN' },
          {
            onSuccess: onClose,
            onError: () => {
              setPendingId(null);
              setError(t('out.save-failed'));
            },
          },
        );
      }}
    />
  );
}

export { ManagerPicker };
