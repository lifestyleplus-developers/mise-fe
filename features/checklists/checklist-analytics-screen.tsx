import { PlaceholderCard } from '@/features/shell/placeholder';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { useT } from '@/shared/i18n';
import { useLocalSearchParams } from 'expo-router';

/**
 * Checklist analytics: not built yet. A Checklist Manager reaches it for their own
 * outlet, so it is not admin-only (FE Spec §3.5).
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
      <PlaceholderCard name={t('checklists.analytics')} />
    </PushedScreen>
  );
}
