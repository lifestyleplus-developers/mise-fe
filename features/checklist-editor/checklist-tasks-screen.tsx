import { PlaceholderCard } from '@/features/shell/placeholder';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { useT } from '@/shared/i18n';

/** CHK-09, built in week 6: the tasks of one checklist, in order. */
export function ChecklistTasksScreen() {
  const t = useT();
  return (
    <PushedScreen
      title={t('editor.tasks-title')}
      adminOnly
      backHref="/checklists/admin"
    >
      <PlaceholderCard id="CHK-09" name="Checklist editor: tasks" week={6} />
    </PushedScreen>
  );
}
