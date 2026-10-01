import { isSessionExpired, useMe } from '@/features/auth/use-me';
import { LaunchScreen } from '@/features/shell/launch-screen';
import { TabBar } from '@/features/shell/tab-bar';
import { TAB } from '@/features/shell/tabs';
import { useT } from '@/shared/i18n';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

/**
 * The signed-in shell. It is also the auth gate: nothing under `(tabs)`
 * renders without an identity, so every screen below can read /auth/me
 * knowing it is there.
 *
 * Three outcomes before the tabs: still loading → launch screen; session
 * gone (401) → back to Login; anything else with nothing cached → launch
 * screen with Retry. A failed *refresh* with a cached identity falls through
 * to the tabs — each screen shows a banner over what it already has.
 */
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
        // Transparent so the app-wide wash behind the navigator shows through.
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      {/* Every tab is declared; the bar decides which are reachable (see
          tab-bar.tsx). Order here is the order the navigator knows them in. */}
      <Tabs.Screen name={TAB.HOME} />
      <Tabs.Screen name={TAB.CHECKLISTS} />
      <Tabs.Screen name={TAB.ISSUES} />
      <Tabs.Screen name={TAB.MODULES} />
      <Tabs.Screen name={TAB.MORE} />
    </Tabs>
  );
}
