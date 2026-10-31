import { useMe } from '@/features/auth/use-me';
import { ItemFilterSheet } from '@/features/inventory/item-filter-sheet';
import {
  MovementRow,
  type MovementRowData,
} from '@/features/inventory/movement-row';
import { useAllInventoryItems } from '@/features/inventory/use-inventory-items';
import {
  useInventoryMovements,
  useMovementQueue,
} from '@/features/inventory/use-inventory-movements';
import { useInventoryOutlets } from '@/features/inventory/use-inventory-outlets';
import { FilterChip } from '@/features/home/filter-chip';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError, OUTLET_MOVEMENT_LOG } from '@/shared/api/client';
import type { InventoryItem } from '@/shared/api/types';
import {
  DateRangeSheet,
  useRangeLabel,
} from '@/shared/components/date-range-sheet';
import { OutletPicker } from '@/shared/components/outlet-picker';
import { PendingPill } from '@/shared/components/pending-pill';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import {
  formatDay,
  formatDayWithWeekday,
  rangeFor,
  toDay,
  type DateRange,
} from '@/shared/lib/date-range';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type Row = MovementRowData & { item: InventoryItem | undefined };

/** Movement log (INV-03): everything recorded at an outlet, by day, newest first. */
export function InventoryLogScreen() {
  const params = useLocalSearchParams<{ item?: string; outlet?: string }>();
  const t = useT();
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);
  const { data: me } = useMe();
  const outlets = useInventoryOutlets();
  const setModulesNotice = useModulesNotice((state) => state.setNotice);
  const rangeLabel = useRangeLabel();

  const [pickedOutlet, setPickedOutlet] = React.useState<number | undefined>(
    params.outlet ? Number(params.outlet) : undefined,
  );
  const outlet =
    outlets.outlets.find((o) => o.id === pickedOutlet) ?? outlets.outlets[0];
  const [pickedItem, setPickedItem] = React.useState<number | null>(
    params.item ? Number(params.item) : null,
  );
  const [range, setRange] = React.useState<DateRange>(() => rangeFor('last7'));
  const [sheet, setSheet] = React.useState<'item' | 'range' | null>(null);

  const items = useAllInventoryItems(outlet?.id);
  const itemList = items.data ?? [];
  const byId = new Map(itemList.map((item) => [item.id, item]));

  // The platform lists a single item's ledger; a whole outlet's log has no endpoint
  // yet. Until it does, the log is per item and defaults to the first one.
  const perItemOnly = !OUTLET_MOVEMENT_LOG;
  const firstItem = [...itemList]
    .filter((item) => !item.is_archived)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)[0];
  const itemId =
    pickedItem ?? (perItemOnly ? firstItem?.id : undefined) ?? null;

  const query = useInventoryMovements(
    {
      outletId: outlet?.id,
      itemId: itemId ?? undefined,
      from: range.from,
      to: range.to,
    },
    outlet !== undefined && !(perItemOnly && itemId === null),
  );

  const queue = useMovementQueue(itemId ?? undefined).filter((write) => {
    const target = byId.get(write.variables.itemId);
    return target === undefined || target.outlet_id === outlet?.id;
  });
  const pull = usePullToRefresh(() => {
    void query.refetch();
    void items.refetch();
  });

  const status = query.error instanceof ApiError ? query.error.status : null;
  const forbidden = status === 403;
  const badRange = status === 400;
  const moduleOff =
    status === 404 ||
    (!outlets.isPending && !outlets.isError && outlets.outlets.length === 0);
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(t('modules.inventory-off'));
    router.replace('/modules');
  }, [moduleOff, router, setModulesNotice, t]);

  const serverRows: Row[] = (
    query.data?.pages.flatMap((page) => page.results) ?? []
  ).map((movement) => ({
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
    item: byId.get(movement.item_id),
  }));
  const queuedRows: Row[] = queue.map((write) => ({
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
    item: byId.get(write.variables.itemId),
  }));
  const rows = [...queuedRows, ...serverRows];
  const waiting = queue.filter((write) => write.kind === 'waiting').length;

  // Rows under a heading for the day they were recorded.
  const today = toDay(new Date());
  const yesterday = rangeFor('yesterday').from;
  const groups: { day: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const day = toDay(new Date(row.recorded_at));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }
  const heading = (day: string) =>
    day === today
      ? t('range.today')
      : day === yesterday
        ? t('range.yesterday')
        : formatDayWithWeekday(new Date(`${day}T12:00:00`), language);

  const itemName = itemId === null ? undefined : byId.get(itemId)?.name;
  const loading =
    outlets.isPending || items.isPending || (query.isLoading && !query.isError);
  const failed =
    (query.isError || items.isError || outlets.isError) &&
    !forbidden &&
    !moduleOff &&
    !badRange;
  const chipsReady = !outlets.isPending && outlet !== undefined;

  function loadMore() {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }

  let body: React.ReactNode;
  if (forbidden) {
    body = (
      <View className="mx-4">
        <Banner tone="error" message={t('inv.not-yours-read')} />
      </View>
    );
  } else if (loading) {
    body = failed ? null : (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border"
      >
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <View
            key={key}
            className={`min-h-16 flex-row items-center gap-3 px-4 py-3 ${key > 0 ? 'border-border border-t' : ''}`}
          >
            <Skeleton className="size-9 rounded-xl" />
            <View className="flex-1 gap-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (failed && rows.length === 0) {
    body = null; // The Retry banner above says so.
  } else if (rows.length === 0) {
    body = (
      <Text className="mx-5 mt-2 text-[15px] leading-snug">
        {format(t('inv.none-between'), {
          a: formatDay(range.from, language),
          b: formatDay(range.to, language),
        })}
      </Text>
    );
  } else {
    body = (
      <>
        {groups.map((group) => (
          <View key={group.day} accessibilityLabel={heading(group.day)}>
            <Text
              accessibilityRole="header"
              className="font-sans-semibold mx-5 mt-4 mb-2 text-[14px] leading-tight tracking-wide"
            >
              {heading(group.day)}
            </Text>
            <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
              {group.rows.map((row, index) => (
                <MovementRow
                  key={row.key}
                  movement={row}
                  unit={row.item?.unit ?? 'COUNT'}
                  first={index === 0}
                  showDate={false}
                  itemName={itemId === null ? row.item?.name : undefined}
                  // A count that began from nothing is the item's opening one.
                  isFirstEver={
                    row.kind === 'COUNT' &&
                    row.derived_in !== null &&
                    row.derived_in === row.quantity
                  }
                />
              ))}
            </View>
          </View>
        ))}
        {query.isFetchingNextPage || query.hasNextPage ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="shadow-card border-border bg-card mx-4 mt-3 min-h-14 flex-row items-center gap-3 rounded-3xl border px-4 py-3"
          >
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="ml-auto h-3.5 w-1/5" />
          </View>
        ) : null}
        <Text className="mx-5 mt-4 text-[13px] leading-snug">
          {t('inv.mistake')}
        </Text>
      </>
    );
  }

  return (
    <PushedScreen
      title={t('modules.log')}
      eyebrow={t('modules.inventory')}
      backHref="/inventory"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
      onEndReached={loadMore}
    >
      {forbidden ? null : (
        <View className="mx-4 mb-3 gap-3">
          <OutletPicker
            outlets={outlets.outlets}
            value={outlet?.id ?? 0}
            onChange={(id) => {
              setPickedOutlet(id);
              setPickedItem(null);
            }}
          />
          {chipsReady ? (
            <View className="flex-row flex-wrap gap-2">
              {perItemOnly ? (
                <FilterChip
                  label={itemName ?? t('inv.item-sheet')}
                  value={undefined}
                  clearLabel={t('home.clear-filter')}
                  onOpen={() => setSheet('item')}
                  onClear={() => undefined}
                />
              ) : (
                <FilterChip
                  label={t('inv.all-items')}
                  value={itemName}
                  clearLabel={t('home.clear-filter')}
                  onOpen={() => setSheet('item')}
                  onClear={() => setPickedItem(null)}
                />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={format(t('range.chip'), {
                  range: rangeLabel(range),
                })}
                onPress={() => setSheet('range')}
                className="border-input-edge bg-card active:bg-accent min-h-11 max-w-full shrink flex-row items-center gap-1 rounded-full border px-3.5"
              >
                <Text
                  numberOfLines={1}
                  className="font-sans-semibold shrink text-[13px]"
                >
                  {rangeLabel(range)}
                </Text>
                <ChevronDown className="text-foreground size-4 shrink-0" />
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      {failed ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void query.refetch();
            void items.refetch();
            outlets.refetch();
          }}
          retrying={query.isRefetching || items.isRefetching}
        />
      ) : null}
      {badRange ? (
        <View className="mx-4 mb-3">
          <Banner tone="error" message={t('range.bad')} />
        </View>
      ) : null}
      {waiting > 0 && !loading ? (
        <View className="mx-4 mb-2">
          <PendingPill
            label={format(t('att.n-waiting'), { n: String(waiting) })}
          />
        </View>
      ) : null}

      {body}

      <ItemFilterSheet
        visible={sheet === 'item'}
        items={itemList}
        value={itemId}
        allowAll={!perItemOnly}
        onPick={(id) => {
          setPickedItem(id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <DateRangeSheet
        visible={sheet === 'range'}
        value={range}
        onChange={setRange}
        onClose={() => setSheet(null)}
      />
    </PushedScreen>
  );
}
