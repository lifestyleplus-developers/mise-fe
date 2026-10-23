import { PlaceholderCard } from '@/features/shell/placeholder';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { useT } from '@/shared/i18n';
import { useLocalSearchParams } from 'expo-router';

/**
 * CHK-06, built in week 6: a checklist's name and schedule. Reached with an
 * id to edit one, without to write a new one.
 */
export function ChecklistEditorScreen() {
  const t = useT();
  // The checklist name is authored content: shown as typed, never translated.
  const { name } = useLocalSearchParams<{ id?: string; name?: string }>();

  return (
    <PushedScreen
      title={name ?? t('editor.new-title')}
      adminOnly
      backHref="/checklists/admin"
    >
      <PlaceholderCard id="CHK-06" name="Checklist editor: schedule" week={6} />
    </PushedScreen>
  );
}
