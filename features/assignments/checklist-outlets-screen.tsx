import { PlaceholderCard } from '@/features/shell/placeholder';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { useT } from '@/shared/i18n';

/** CHK-07, built in week 7: tick the outlets a checklist runs at. */
export function ChecklistOutletsScreen() {
  const t = useT();
  return (
    <PushedScreen
      title={t('editor.outlets-title')}
      adminOnly
      backHref="/checklists/admin"
    >
      <PlaceholderCard id="CHK-07" name="Assignment: pick outlets" week={7} />
    </PushedScreen>
  );
}
