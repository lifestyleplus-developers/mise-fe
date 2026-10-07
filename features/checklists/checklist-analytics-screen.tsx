import { PlaceholderCard } from '@/features/shell/placeholder';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { useT } from '@/shared/i18n';
import { useLocalSearchParams } from 'expo-router';

/**
 * OVS-02, built in week 10. A CL_ADMIN reaches it for their own outlet, so it
 * is not admin-only (FE Spec §3.5).
 */
export function ChecklistAnalyticsScreen() {
  const t = useT();
  // The checklist name is authored content: shown as typed, never translated.
  const { name } = useLocalSearchParams<{ id: string; name?: string }>();

  return (
    <PushedScreen
      title={name ?? t('checklists.analytics')}
      backHref="/checklists"
    >
      <PlaceholderCard id="OVS-02" name="Checklist analytics" week={10} />
    </PushedScreen>
  );
}
