import { useMe } from '@/features/auth/use-me';
import { TabScreen } from '@/features/shell/tab-screen';
import { ListGroup } from '@/shared/components/list-group';
import { canAdminister } from '@/shared/constants/roles';
import { useT } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import { Settings, Store, Users } from 'lucide-react-native';

/**
 * More — Settings, and Administration for those who author (FE Spec §1, §2).
 * Each row pushes a screen over the tabs; the screens themselves are built
 * in week 2 and stand in as placeholders (see `app/settings.tsx` and friends).
 */
export function MoreScreen() {
  const { data: me } = useMe();
  const t = useT();
  const router = useRouter();

  // The shell does not render tabs without an identity; this is for the
  // frame in which sign-out has cleared it and navigation has not landed.
  if (!me) return null;

  return (
    <TabScreen title={t('tab.more')}>
      <ListGroup
        rows={[
          {
            id: 'settings',
            icon: Settings,
            label: t('more.settings'),
            onSelect: () => router.push('/settings'),
          },
        ]}
      />
      {/* Absent, not disabled, for anyone below ADMIN (FE Spec §1). */}
      {canAdminister(me.user.role) ? (
        <ListGroup
          heading={t('more.administration')}
          rows={[
            {
              id: 'outlets',
              icon: Store,
              label: t('more.outlets'),
              onSelect: () => router.push('/outlets'),
            },
            {
              id: 'users',
              icon: Users,
              label: t('more.users'),
              onSelect: () => router.push('/users'),
            },
          ]}
        />
      ) : null}
    </TabScreen>
  );
}
