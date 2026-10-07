import { PlaceholderCard } from '@/features/shell/placeholder';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { useT } from '@/shared/i18n';
import { useLocalSearchParams } from 'expo-router';

/**
 * CHK-08, built in week 7. A CL_ADMIN manages implementers here, so it is not
 * admin-only — the platform decides what each caller may change (Model §2).
 */
export function AssignmentMembersScreen() {
  const t = useT();
  const { checklist, outlet } = useLocalSearchParams<{
    id: string;
    checklist?: string;
    outlet?: string;
  }>();

  // Both are authored content, shown exactly as typed.
  const title =
    checklist && outlet ? `${checklist} · ${outlet}` : t('checklists.team');

  return (
    <PushedScreen title={title} backHref="/checklists">
      <PlaceholderCard id="CHK-08" name="Assignment: membership" week={7} />
    </PushedScreen>
  );
}
