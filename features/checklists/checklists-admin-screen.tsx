import { PlaceholderCard } from '@/features/shell/placeholder';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { useT } from '@/shared/i18n';

/** CHK-10, built in week 6: every checklist in the business, for ADMIN and OWNER. */
export function ChecklistsAdminScreen() {
  const t = useT();
  return (
    <PushedScreen title={t('more.checklists')} adminOnly backHref="/more">
      <PlaceholderCard id="CHK-10" name="Checklists (admin list)" week={6} />
    </PushedScreen>
  );
}
