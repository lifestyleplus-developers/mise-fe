import { useMe } from '@/features/auth/use-me';
import { moduleGroups } from '@/features/shell/modules';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { TabScreen } from '@/features/shell/tab-screen';
import { AutoDismissBanner } from '@/shared/components/auto-dismiss-banner';
import { EmptyState } from '@/shared/components/empty-state';
import { ListGroup } from '@/shared/components/list-group';
import { useT } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import { LayoutGrid } from 'lucide-react-native';
import { View } from 'react-native';

/** Modules tab: Attendance, Inventory and Spot checks, each only if this person can open it. */
export function ModulesScreen() {
  const { data: me } = useMe();
  const t = useT();
  const router = useRouter();
  const notice = useModulesNotice((state) => state.notice);
  const clearNotice = useModulesNotice((state) => state.clearNotice);

  if (!me) return null;
  const groups = moduleGroups(me);

  return (
    <TabScreen title={t('tab.modules')}>
      {notice ? (
        <View className="mx-4 mb-3">
          <AutoDismissBanner
            tone="notice"
            message={notice}
            onDismiss={clearNotice}
          />
        </View>
      ) : null}

      {groups.length === 0 ? (
        // The tab is hidden when there is nothing to open; this is a stale visit.
        <EmptyState icon={LayoutGrid} title={t('modules.empty')} />
      ) : (
        groups.map((group) => (
          <ListGroup
            key={group.id}
            heading={group.heading ? t(group.heading) : undefined}
            rows={group.rows.map((row) => ({
              id: row.id,
              icon: row.icon,
              label: t(row.label),
              onSelect: () => router.push(row.href),
            }))}
          />
        ))
      )}
    </TabScreen>
  );
}
