import { useSignOut } from '@/features/auth/use-sign-out';
import { PlaceholderCard } from '@/features/shell/placeholder-card';
import { TabScreen } from '@/features/shell/tab-screen';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';

/**
 * The tab roots other than Home, as the mockup draws them in week 1: a
 * titled frame around a placeholder naming the screen and its week. Each is
 * deleted when its feature lands — the route file re-points at the real
 * screen and this file shrinks.
 */

export function ChecklistsPlaceholder() {
  const t = useT();
  return (
    <TabScreen title={t('tab.checklists')}>
      <PlaceholderCard id="CHK-05" name="Checklist list" week={4} />
    </TabScreen>
  );
}

export function IssuesPlaceholder() {
  const t = useT();
  return (
    <TabScreen title={t('tab.issues')}>
      <PlaceholderCard id="ISS-01" name="Issues list" week={10} />
    </TabScreen>
  );
}

export function ModulesPlaceholder() {
  const t = useT();
  return (
    <TabScreen title={t('tab.modules')}>
      <PlaceholderCard id="MOD-01" name="Modules" week={8} />
    </TabScreen>
  );
}

/**
 * More is Settings and Administration (week 2). Sign out lives here for now
 * because the login screen's own sign-out went when it started redirecting
 * to Home, and Settings (FE Spec §3.12) does not exist to take it.
 */
export function MorePlaceholder() {
  const t = useT();
  const signOut = useSignOut();
  return (
    <TabScreen title={t('tab.more')}>
      <PlaceholderCard id="FND-03" name="Settings" week={2}>
        <Button variant="outline" onPress={signOut}>
          <Text>{t('settings.sign-out')}</Text>
        </Button>
      </PlaceholderCard>
    </TabScreen>
  );
}
