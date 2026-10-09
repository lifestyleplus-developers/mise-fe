import { AddOutletSheet } from '@/features/outlets/add-outlet-sheet';
import { ArchivedBadge } from '@/features/outlets/archived-badge';
import { isForbidden } from '@/features/outlets/outlet-errors';
import {
  useOutletNotice,
  useOutletNoticeText,
} from '@/features/outlets/outlet-notice';
import { useOutlets } from '@/features/outlets/use-outlets';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { EmptyState } from '@/shared/components/empty-state';
import { ListGroup } from '@/shared/components/list-group';
import { NewButton } from '@/shared/components/new-button';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SkeletonRows } from '@/shared/components/skeleton';
import { SwitchRow } from '@/shared/components/switch-row';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import { Store } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** Outlets list (ADM-01): add, open to edit, show archived. */
export function OutletsScreen() {
  const t = useT();
  const router = useRouter();
  const { data, isPending, isError, error, refetch, isRefetching } =
    useOutlets();
  const noticeText = useOutletNoticeText();
  const clearNotice = useOutletNotice((state) => state.clearNotice);
  const [showArchived, setShowArchived] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  const forbidden = isError && isForbidden(error);
  const outlets = (data ?? []).filter(
    (outlet) => showArchived || !outlet.is_archived,
  );

  function openAdd() {
    clearNotice();
    setAdding(true);
  }

  const showNew = !forbidden && (isPending || outlets.length > 0);

  return (
    <PushedScreen
      title={t('more.outlets')}
      adminOnly
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
      action={showNew ? <NewButton onPress={openAdd} /> : undefined}
    >
      {forbidden ? (
        <View className="mx-4">
          <Banner tone="error" message={t('admin.no-access')} />
        </View>
      ) : (
        <>
          {isError ? (
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void refetch()}
              retrying={isRefetching}
            />
          ) : null}
          {noticeText ? (
            <View className="mx-4 mb-3">
              <Banner tone="notice" message={noticeText} />
            </View>
          ) : null}

          {isPending ? (
            <SkeletonRows count={3} />
          ) : outlets.length === 0 ? (
            <EmptyState
              icon={Store}
              title={t('outlets.empty')}
              action={
                <Button onPress={openAdd}>
                  <Text>{t('outlets.add')}</Text>
                </Button>
              }
            />
          ) : (
            <ListGroup
              rows={outlets.map((outlet) => ({
                id: String(outlet.id),
                icon: Store,
                label: outlet.name,
                trailing: outlet.is_archived ? <ArchivedBadge /> : undefined,
                onSelect: () => {
                  clearNotice();
                  router.push(`/outlets/${outlet.id}`);
                },
              }))}
            />
          )}

          {isPending ? null : (
            <View className="shadow-card border-border bg-card mx-4 mt-1 overflow-hidden rounded-3xl border">
              <SwitchRow
                label={t('outlets.show-archived')}
                checked={showArchived}
                onChange={setShowArchived}
              />
            </View>
          )}
        </>
      )}

      <AddOutletSheet visible={adding} onClose={() => setAdding(false)} />
    </PushedScreen>
  );
}
