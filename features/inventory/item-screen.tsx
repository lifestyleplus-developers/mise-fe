import { useMe } from '@/features/auth/use-me';
import { formatNumber } from '@/features/inventory/format';
import { ItemSheet } from '@/features/inventory/item-sheet';
import { useInventoryNotice } from '@/features/inventory/inventory-notice';
import {
  MovementRow,
  type MovementRowData,
} from '@/features/inventory/movement-row';
import { MovementSheet } from '@/features/inventory/movement-sheet';
import { useInventoryItem } from '@/features/inventory/use-inventory-items';
import {
  useInventoryMovements,
  useMovementQueue,
  useRecordMovement,
} from '@/features/inventory/use-inventory-movements';
import { useInventoryOutlets } from '@/features/inventory/use-inventory-outlets';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { InventoryMovementKind } from '@/shared/api/types';
import { PendingPill } from '@/shared/components/pending-pill';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { formatDay } from '@/shared/lib/date-range';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CircleAlert,
  Info,
  Minus,
  PackageOpen,
  Pencil,
  Plus,
  SquarePen,
} from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** How many movements the page shows before "See all movements". */
const SHOWN = 10;

/** An item (INV-02): the balance, three ways to change it, and what has happened. */
export function InventoryItemScreen() {
  const { id, outlet } = useLocalSearchParams<{
    id: string;
    outlet?: string;
  }>();
  const itemId = Number(id);
  const t = useT();
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);
  const formatClock = useFormatClock();
  const { data: me } = useMe();
  const outlets = useInventoryOutlets();
  const setListNotice = useInventoryNotice((state) => state.setNotice);

  const itemQuery = useInventoryItem(itemId, Number(outlet));
  const item = itemQuery.data;
  const movementsQuery = useInventoryMovements({ itemId });
  const queue = useMovementQueue(itemId);
  const record = useRecordMovement();
  const pull = usePullToRefresh(() => {
    void itemQuery.refetch();
    void movementsQuery.refetch();
  });

  const [sheet, setSheet] = React.useState<InventoryMovementKind | null>(null);
  const [editing, setEditing] = React.useState(false);

  const status =
    itemQuery.error instanceof ApiError ? itemQuery.error.status : null;
  const gone = status === 404 || item?.is_archived === true;
  const forbidden = status === 403;
  const roleLost = queue.some((write) => write.error?.status === 403);

  const admin = me ? canAdminister(me.user.tenant_role) : false;
  const recorder = Boolean(
    item && me?.memberships.inventory_outlets.includes(item.outlet_id),
  );
  const canRecord = recorder && !roleLost;

  const serverRows =
    movementsQuery.data?.pages.flatMap((page) => page.results) ?? [];
  const total = movementsQuery.data?.pages[0]?.count ?? null;
  const nothingRecorded = total === 0 && queue.length === 0;
  const lastCount = serverRows.find((m) => m.kind === 'COUNT');
  const oldestId = movementsQuery.hasNextPage
    ? null
    : serverRows[serverRows.length - 1]?.id;

  const rows: (MovementRowData & { id?: number })[] = [
    ...queue.map((write) => ({
      key: `queued-${write.key}`,
      kind: write.variables.request.kind,
      quantity: write.variables.request.quantity,
      unit_price: write.variables.request.unit_price ?? null,
      note: write.variables.request.note ?? null,
      derived_in: null,
      derived_out: null,
      balance_after: null,
      recorded_by: me?.user.full_name ?? '',
      recorded_at: new Date(write.submittedAt).toISOString(),
      waiting: write.kind === 'waiting',
      refused: write.kind === 'refused',
    })),
    ...serverRows.map((movement) => ({
      id: movement.id,
      key: `m-${movement.id}`,
      kind: movement.kind,
      quantity: movement.quantity,
      unit_price: movement.unit_price,
      note: movement.note,
      derived_in: movement.derived_in,
      derived_out: movement.derived_out,
      balance_after: movement.balance_after,
      recorded_by: movement.recorded_by.full_name,
      recorded_at: movement.recorded_at,
    })),
  ];
  const waiting = queue.filter((write) => write.kind === 'waiting').length;

  const title = item?.name ?? '';
  const multiOutlet = outlets.outlets.length > 1;
  const outletName = outlets.outlets.find(
    (o) => o.id === item?.outlet_id,
  )?.name;

  let body: React.ReactNode;
  if (gone || forbidden) {
    body = (
      <View className="mx-4 gap-3">
        <Banner
          tone="error"
          message={t(gone ? 'inv.gone' : 'inv.not-yours-read')}
        />
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onPress={() => router.replace('/inventory')}
        >
          <Text>{t('common.back')}</Text>
        </Button>
      </View>
    );
  } else if (!item) {
    body = itemQuery.isError ? (
      <RetryBanner
        message={t('common.offline')}
        retryLabel={t('common.retry')}
        onRetry={() => void itemQuery.refetch()}
        retrying={itemQuery.isRefetching}
      />
    ) : (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="gap-4"
      >
        <View className="shadow-card border-border bg-card mx-4 h-40 rounded-3xl border" />
        <View className="shadow-card border-border bg-card mx-4 gap-3 rounded-3xl border p-4">
          {[0, 1, 2, 3].map((key) => (
            <View key={key} className="gap-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </View>
          ))}
        </View>
      </View>
    );
  } else {
    const unitLabel = t(`inv.u.${item.unit}` as MessageKey);
    body = (
      <>
        {waiting > 0 ? (
          <View className="mx-4 mb-3">
            <PendingPill
              label={format(t('att.n-waiting'), { n: String(waiting) })}
            />
          </View>
        ) : null}
        {itemQuery.isError ? (
          <RetryBanner
            message={t('common.offline')}
            retryLabel={t('common.retry')}
            onRetry={() => void itemQuery.refetch()}
            retrying={itemQuery.isRefetching}
          />
        ) : null}
        {roleLost ? (
          <View className="mx-4 mb-3">
            <Banner tone="error" message={t('inv.not-yours-record')} />
          </View>
        ) : null}

        <View
          accessibilityLabel={t('inv.balance')}
          className="shadow-card border-border bg-card mx-4 rounded-3xl border px-5 py-5"
        >
          {multiOutlet && outletName ? (
            <Text className="font-sans-semibold mb-1 text-[13px]">
              {outletName}
            </Text>
          ) : null}
          <Text className="text-muted-foreground font-sans-semibold text-[13px]">
            {t('inv.balance')}
          </Text>
          <Text className="font-sans-bold text-[40px] leading-tight">
            {formatNumber(item.balance, item.unit)}
            <Text className="font-sans text-[20px]">{` ${unitLabel}`}</Text>
          </Text>
          {item.balance < 0 ? (
            <View className="mt-1 gap-1">
              <View className="flex-row items-center gap-1">
                <CircleAlert className="text-warning-soft-foreground size-4" />
                <Text className="text-warning-soft-foreground font-sans-semibold text-[13px]">
                  {t('inv.below-zero')}
                </Text>
              </View>
              <Text className="text-[14px] leading-snug">
                {t('inv.below-zero-line')}
              </Text>
            </View>
          ) : null}
          <Text className="mt-2 text-[14px] leading-snug">
            {lastCount
              ? format(t('inv.last-counted'), {
                  when: `${formatDay(lastCount.recorded_at.slice(0, 10), language)}, ${formatClock(isoToClock(lastCount.recorded_at))}`,
                  who: lastCount.recorded_by.full_name,
                })
              : t('inv.not-counted')}
          </Text>
        </View>

        {canRecord ? (
          <View className="mx-4 mt-4 gap-3">
            {/* Set actual leads: staff record what is left, not what was used. */}
            <Button
              className="min-h-14 w-full"
              onPress={() => setSheet('COUNT')}
            >
              <SquarePen className="text-primary-foreground size-5" />
              <Text className="text-[16px]">
                {t(nothingRecorded ? 'inv.opening-count' : 'inv.set-actual')}
              </Text>
            </Button>
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="h-auto min-h-12 flex-1 flex-col gap-0 py-1.5"
                onPress={() => setSheet('ADD')}
              >
                <View className="flex-row items-center gap-2">
                  <Plus className="text-foreground size-4" />
                  <Text>{t('inv.add-btn')}</Text>
                </View>
                <Text aria-hidden className="text-[12px] opacity-0">
                  {t('inv.taken-out')}
                </Text>
              </Button>
              <Button
                variant="outline"
                className="h-auto min-h-12 flex-1 flex-col gap-0 py-1.5"
                onPress={() => setSheet('REMOVE')}
              >
                <View className="flex-row items-center gap-2">
                  <Minus className="text-foreground size-4" />
                  <Text>{t('inv.remove-btn')}</Text>
                </View>
                <Text className="text-muted-foreground text-[12px]">
                  {t('inv.taken-out')}
                </Text>
              </Button>
            </View>
          </View>
        ) : roleLost ? null : (
          <View className="mx-5 mt-4 flex-row items-start gap-2">
            <Info className="text-foreground mt-0.5 size-4 shrink-0" />
            <Text className="min-w-0 flex-1 text-[14px] leading-snug">
              {t('inv.read-only')}
            </Text>
          </View>
        )}

        <View className="mt-6">
          <Text
            accessibilityRole="header"
            className="font-display mx-5 mb-2 text-[17px] leading-tight"
          >
            {t('inv.movements')}
          </Text>
          {movementsQuery.isPending ? (
            <View className="shadow-card border-border bg-card mx-4 gap-3 rounded-3xl border p-4">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-3.5 w-3/4" />
              ))}
            </View>
          ) : movementsQuery.isError && rows.length === 0 ? (
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void movementsQuery.refetch()}
              retrying={movementsQuery.isRefetching}
            />
          ) : rows.length === 0 ? (
            <View className="shadow-card border-border bg-card mx-4 flex-row items-center gap-3 rounded-3xl border px-4 py-4">
              <PackageOpen className="text-foreground size-5 shrink-0" />
              <Text className="text-[15px]">{t('inv.no-moves')}</Text>
            </View>
          ) : (
            <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
              {rows.slice(0, SHOWN).map((row, index) => (
                <MovementRow
                  key={row.key}
                  movement={row}
                  unit={item.unit}
                  first={index === 0}
                  isFirstEver={row.id !== undefined && row.id === oldestId}
                />
              ))}
            </View>
          )}
          {rows.length > 0 ? (
            <>
              <View className="mx-4 mt-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onPress={() =>
                    router.push({
                      pathname: '/inventory/log',
                      params: { item: item.id, outlet: item.outlet_id },
                    })
                  }
                >
                  <Text>{t('inv.see-all')}</Text>
                </Button>
              </View>
              <Text className="mx-5 mt-3 text-[13px] leading-snug">
                {t('inv.mistake')}
              </Text>
            </>
          ) : null}
        </View>
      </>
    );
  }

  return (
    <PushedScreen
      title={title}
      eyebrow={t('modules.inventory')}
      backHref="/inventory"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
      action={
        admin && item && !gone && !forbidden ? (
          <Button variant="outline" size="sm" onPress={() => setEditing(true)}>
            <Pencil className="text-foreground size-4" />
            <Text>{t('inv.edit-title')}</Text>
          </Button>
        ) : undefined
      }
    >
      {body}

      {sheet && item ? (
        <MovementSheet
          key={sheet}
          kind={sheet}
          item={item}
          isFirst={nothingRecorded}
          onClose={() => setSheet(null)}
          onSave={(request) => {
            record.mutate({ itemId: item.id, request });
            setSheet(null);
          }}
        />
      ) : null}
      {editing && item ? (
        <ItemSheet
          item={item}
          outletId={item.outlet_id}
          outletName={outletName ?? ''}
          multiOutlet={multiOutlet}
          onClose={() => setEditing(false)}
          onAdded={() => setEditing(false)}
          onArchived={(archived) => {
            setEditing(false);
            setListNotice(format(t('inv.archived'), { name: archived.name }));
            router.replace('/inventory');
          }}
          onLost={() => void itemQuery.refetch()}
        />
      ) : null}
    </PushedScreen>
  );
}
