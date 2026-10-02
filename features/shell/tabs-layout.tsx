import { isSessionExpired, useMe } from '@/features/auth/use-me';
import { LaunchScreen } from '@/features/shell/launch-screen';
import { TabBar } from '@/features/shell/tab-bar';
import { TAB } from '@/features/shell/tabs';
import { useT } from '@/shared/i18n';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

/** The signed-in shell. */
export function TabsLayout() {
  const { data: me, isError, error, refetch } = useMe();
  const t = useT();

  if (!me) {
    if (isError && isSessionExpired(error)) return <Redirect href="/" />;
    return (
      <LaunchScreen
        loadingLabel={t('common.loading')}
        error={
          isError
            ? {
                message: t('common.offline'),
                retryLabel: t('common.retry'),
                onRetry: () => void refetch(),
              }
            : undefined
        }
      />
    );
  }

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name={TAB.HOME} />
      <Tabs.Screen name={TAB.CHECKLISTS} />
      <Tabs.Screen name={TAB.ISSUES} />
      <Tabs.Screen name={TAB.MODULES} />
      <Tabs.Screen name={TAB.MORE} />
    </Tabs>
  );
}
