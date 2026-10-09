import { useMe } from '@/features/auth/use-me';
import { TabScreen } from '@/features/shell/tab-screen';
import { ListGroup } from '@/shared/components/list-group';
import { canAdminister } from '@/shared/constants/roles';
import { useT } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import { Settings, Store, Users } from 'lucide-react-native';

/** More tab: Settings, plus Administration for OWNER and ADMIN. */
export function MoreScreen() {
  const { data: me } = useMe();
  const t = useT();
  const router = useRouter();

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
