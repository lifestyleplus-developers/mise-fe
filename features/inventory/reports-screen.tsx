import { formatNumber, useFormatQuantity } from '@/features/inventory/format';
import {
  useStockOnHand,
  useStockSpend,
  useStockSummary,
} from '@/features/inventory/use-inventory-reports';
import { useInventoryOutlets } from '@/features/inventory/use-inventory-outlets';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { StockSummaryReport } from '@/shared/api/types';
import {
  DateRangeSheet,
  useRangeLabel,
} from '@/shared/components/date-range-sheet';
import {
  OutletPicker,
  useSelectedOutlet,
} from '@/shared/components/outlet-picker';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Text } from '@/shared/components/ui/text';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { formatDay, rangeFor, type DateRange } from '@/shared/lib/date-range';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  Info,
  ScrollText,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

type Report = 'stock' | 'summary' | 'spend';

/** Rupees, as the platform's amounts are: whole or two decimals. */
const rupees = (amount: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount)}`;

/** Stock reports (INV-04): what is on hand, what moved, and what was spent. */
export function InventoryReportsScreen() {
  const t = useT();
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);
  const formatClock = useFormatClock();
  const rangeLabel = useRangeLabel();
  const outlets = useInventoryOutlets();
  const [outlet, setOutletId] = useSelectedOutlet(outlets.outlets);
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const [report, setReport] = React.useState<Report>('stock');
  const [range, setRange] = React.useState<DateRange>(() => rangeFor('last7'));
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Only the report on screen is asked for.
  const stock = useStockOnHand(outlet?.id, report === 'stock');
  const summary = useStockSummary(
    { outletId: outlet?.id, from: range.from, to: range.to },
    report === 'summary',
  );
  const spend = useStockSpend(
    { outletId: outlet?.id, from: range.from, to: range.to },
    report === 'spend',
  );
  const active =
    report === 'stock' ? stock : report === 'summary' ? summary : spend;
  const pull = usePullToRefresh(() => {
    void active.refetch();
    outlets.refetch();
  });

  const status = active.error instanceof ApiError ? active.error.status : null;
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

  const loading = outlets.isPending || (active.isLoading && !active.isError);
  const failed =
    (active.isError || outlets.isError) &&
    !forbidden &&
    !moduleOff &&
    !badRange;
  const span =
    range.from === range.to
      ? formatDay(range.from, language)
      : `${formatDay(range.from, language)} – ${formatDay(range.to, language)}`;
  const emptyRange = format(t('inv.none-between'), {
    a: formatDay(range.from, language),
    b: formatDay(range.to, language),
  });

  let body: React.ReactNode;
  if (forbidden) {
    body = (
      <View className="mx-4">
        <Banner tone="error" message={t('inv.not-yours-read')} />
      </View>
    );
  } else if (loading) {
    body = failed ? null : <SkeletonRows count={7} />;
  } else if (!active.data) {
    body = null; // The Retry banner above says so.
  } else if (report === 'stock' && stock.data) {
    body =
      stock.data.items.length === 0 ? (
        <Text className="mx-5 mt-2 text-[15px]">{t('inv.no-items')}</Text>
      ) : (
        <>
          <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
            {stock.data.items.map((item, index) => (
              <StockRow key={item.item_id} item={item} first={index === 0} />
            ))}
          </View>
          <Text className="text-muted-foreground mx-5 mt-3 text-[13px]">
            {format(t('inv.as-of'), {
              time: formatClock(isoToClock(stock.data.as_of)),
            })}
          </Text>
        </>
      );
  } else if (report === 'summary' && summary.data) {
    const { items } = summary.data;
    body =
      items.length === 0 ? (
        <Text className="mx-5 mt-2 text-[15px]">{t('inv.no-items')}</Text>
      ) : items.every((item) => item.in === 0 && item.out === 0) ? (
        <Text className="mx-5 mt-2 text-[15px] leading-snug">{emptyRange}</Text>
      ) : (
        <>
          <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
            {items.map((item, index) => (
              <SummaryRow key={item.item_id} item={item} first={index === 0} />
            ))}
          </View>
          <Text className="mx-5 mt-3 text-[13px] leading-snug">
            {t('inv.sum-note')}
          </Text>
        </>
      );
  } else if (report === 'spend' && spend.data) {
    const data = spend.data;
    body = (
      <>
        <View
          accessibilityLabel={t('inv.spend-total')}
          className="shadow-card border-border bg-card mx-4 rounded-3xl border px-5 py-5"
        >
          <Text className="text-muted-foreground font-sans-semibold text-[13px]">
            {t('inv.spend-total')}
          </Text>
          <Text className="font-sans-bold text-[34px] leading-tight">
            {rupees(data.total)}
          </Text>
          <Text className="text-[13px]">{span}</Text>
        </View>
        {data.items.length > 0 ? (
          <View className="shadow-card border-border bg-card mx-4 mt-3 overflow-hidden rounded-3xl border">
            {data.items.map((item, index) => (
              <View
                key={item.item_id}
                className={`min-h-14 flex-row items-center gap-3 px-4 py-2.5 ${
                  index > 0 ? 'border-border border-t' : ''
                }`}
              >
                <Text className="font-sans-medium min-w-0 flex-1 text-[15px] leading-snug">
                  {item.name}
                </Text>
                <Text className="font-sans-semibold shrink-0 text-[15px]">
                  {rupees(item.amount)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text className="mx-5 mt-3 text-[13px] leading-snug">
          {t('inv.spend-note')}
        </Text>
      </>
    );
  }

  return (
    <PushedScreen
      title={t('modules.reports')}
      eyebrow={t('modules.inventory')}
      backHref="/inventory"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
    >
      {forbidden ? null : (
        <View className="mx-4 mb-3 gap-3">
          <OutletPicker
            outlets={outlets.outlets}
            value={outlet?.id ?? 0}
            onChange={setOutletId}
          />
          <SegmentedControl
            label={t('inv.report')}
            value={report}
            onChange={setReport}
            options={[
              { value: 'stock', label: t('inv.stock') },
              { value: 'summary', label: t('inv.summary') },
              { value: 'spend', label: t('inv.spend') },
            ]}
          />
          {outlet ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/inventory/log',
                  params: { outlet: outlet.id },
                })
              }
              className="shadow-card border-border bg-card active:bg-accent min-h-14 flex-row items-center gap-3 rounded-3xl border px-4 py-2"
            >
              <ScrollText className="text-foreground size-5 shrink-0" />
              <Text className="font-sans-medium min-w-0 flex-1 text-[15px]">
                {t('modules.log')}
              </Text>
              <ChevronRight className="text-muted-foreground size-5 shrink-0" />
            </Pressable>
          ) : null}
        </View>
      )}

      {failed ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void active.refetch();
            outlets.refetch();
          }}
          retrying={active.isRefetching || outlets.isRefetching}
        />
      ) : null}
      {failed && active.data ? (
        <Text className="mx-5 mb-3 text-[13px] leading-snug">
          {t('inv.showing-last')}
        </Text>
      ) : null}
      {badRange ? (
        <View className="mx-4 mb-3">
          <Banner tone="error" message={t('range.bad')} />
        </View>
      ) : null}

      {report !== 'stock' && !forbidden ? (
        <View className="mx-4 mb-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={format(t('range.chip'), {
              range: rangeLabel(range),
            })}
            onPress={() => setSheetOpen(true)}
            className="border-input-edge bg-card active:bg-accent min-h-11 max-w-full shrink flex-row items-center gap-1 self-start rounded-full border px-3.5"
          >
            <Text
              numberOfLines={1}
              className="font-sans-semibold shrink text-[13px]"
            >
              {rangeLabel(range)}
            </Text>
            <ChevronDown className="text-foreground size-4 shrink-0" />
          </Pressable>
          <Text className="font-sans-semibold mt-2 px-1 text-[13px]">
            {span}
          </Text>
        </View>
      ) : null}

      {body}

      <DateRangeSheet
        visible={sheetOpen}
        value={range}
        onChange={setRange}
        onClose={() => setSheetOpen(false)}
      />
    </PushedScreen>
  );
}

function BelowZero() {
  const t = useT();
  return (
    <View className="flex-row items-center gap-1">
      <Info className="text-warning-soft-foreground size-3.5" />
      <Text className="text-warning-soft-foreground font-sans-semibold text-[12px]">
        {t('inv.below-zero')}
      </Text>
    </View>
  );
}

function StockRow({
  item,
  first,
}: {
  item: {
    name: string;
    unit: StockSummaryReport['items'][number]['unit'];
    balance: number;
  };
  first: boolean;
}) {
  const formatQuantity = useFormatQuantity();
  return (
    <View
      className={`min-h-14 flex-row items-center gap-3 px-4 py-2.5 ${
        first ? '' : 'border-border border-t'
      }`}
    >
      <Text className="font-sans-medium min-w-0 flex-1 text-[15px] leading-snug">
        {item.name}
      </Text>
      <View className="shrink-0 items-end">
        <Text className="font-sans-semibold text-[15px]">
          {formatQuantity(item.balance, item.unit)}
        </Text>
        {item.balance < 0 ? <BelowZero /> : null}
      </View>
    </View>
  );
}

/** Opening, in, out and closing: four to a row, or two by two on a narrow phone. */
function SummaryRow({
  item,
  first,
}: {
  item: StockSummaryReport['items'][number];
  first: boolean;
}) {
  const t = useT();
  const { width } = useWindowDimensions();
  // The card sits 16pt in from the screen and pads 16pt again.
  const wide = width - 64 >= 368;
  const figures: { label: MessageKey; value: number; strong?: boolean }[] = [
    { label: 'inv.opening', value: item.opening },
    { label: 'inv.in', value: item.in },
    { label: 'inv.out-col', value: item.out, strong: true },
    { label: 'inv.closing', value: item.closing },
  ];
  return (
    <View className={`px-4 py-3 ${first ? '' : 'border-border border-t'}`}>
      <Text className="font-sans-semibold text-[15px] leading-snug">
        {item.name}
      </Text>
      <View className="mt-2 flex-row flex-wrap gap-y-2">
        {figures.map(({ label, value, strong }) => (
          <View key={label} style={{ width: wide ? '25%' : '50%' }}>
            <Text className="text-muted-foreground font-sans-medium text-[12px] leading-snug">
              {t(label)}
            </Text>
            <Text
              className={`text-[16px] leading-snug ${strong ? 'font-sans-bold' : 'font-sans-medium'}`}
            >
              {formatNumber(value, item.unit)}
              <Text className="text-muted-foreground font-sans-medium text-[12px]">
                {` ${t(`inv.u.${item.unit}` as MessageKey)}`}
              </Text>
            </Text>
            {value < 0 ? <BelowZero /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}
