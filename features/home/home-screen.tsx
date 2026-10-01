import { useMe } from '@/features/auth/use-me';
import { PlaceholderCard } from '@/features/shell/placeholder-card';
import { TAB } from '@/features/shell/tabs';
import { TabScreen } from '@/features/shell/tab-screen';
import { EmptyState } from '@/shared/components/empty-state';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { useT } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';

/**
 * Home — "what needs doing now" (FE Spec §3.2). The week-1 shell: header,
 * and the one state the mockup specifies for this tab, an OWNER or ADMIN
 * with nothing assigned. The three run groups — Open now, Overseeing,
 * Upcoming — are specced and built in week 3 and stand in as a placeholder.
 */
export function HomeScreen() {
  const { data: me } = useMe();
  const t = useT();
  const router = useRouter();

  // The shell does not render tabs without an identity; this is for the
  // frame in which sign-out has cleared it and navigation has not landed.
  if (!me) return null;

  const hasAssignments =
    me.memberships.cl_imp_assignments.length > 0 ||
    me.memberships.cl_admin_assignments.length > 0;

  return (
    <TabScreen title={t('tab.home')} eyebrow={me.business.name}>
      {/* §2: an OWNER with no assignments sees an empty Home with a pointer
          to Checklists — not a different landing screen. */}
      {!hasAssignments && canAdminister(me.user.role) ? (
        <EmptyState
          icon={ClipboardList}
          title={t('home.empty.title')}
          action={
            <Button onPress={() => router.navigate(`/${TAB.CHECKLISTS}`)}>
              <Text>{t('home.empty.action')}</Text>
            </Button>
          }
        />
      ) : (
        <PlaceholderCard
          id="CHK-01"
          name="Home: Open now · Overseeing · Upcoming"
          week={3}
        />
      )}
    </TabScreen>
  );
}
