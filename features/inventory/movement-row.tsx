import { useFormatQuantity } from '@/features/inventory/format';
import { useCountInfo } from '@/features/inventory/movement-text';
import type { InventoryMovementKind, InventoryUnit } from '@/shared/api/types';
import { Text } from '@/shared/components/ui/text';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { formatDay } from '@/shared/lib/date-range';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { cn } from '@/shared/lib/utils';
import { useLanguageStore } from '@/shared/stores/language-store';
import {
  CircleAlert,
  Clock,
  Info,
  Minus,
  Plus,
  SquarePen,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

/** What a row shows: a movement the platform holds, or one still on its way. */
export type MovementRowData = {
  key: string;
  kind: InventoryMovementKind;
  quantity: number;
  unit_price: number | null;
  note: string | null;
  derived_in: number | null;
  derived_out: number | null;
  balance_after: number | null;
  recorded_by: string;
  recorded_at: string;
  /** Held on the phone: "Waiting to send", the balance unchanged. */
  waiting?: boolean;
  /** The platform refused it: "Not recorded". */
  refused?: boolean;
};

const KIND: Record<
  InventoryMovementKind,
  { label: MessageKey; Icon: LucideIcon }
> = {
  ADD: { label: 'inv.k-add', Icon: Plus },
  REMOVE: { label: 'inv.k-remove', Icon: Minus },
  COUNT: { label: 'inv.k-count', Icon: SquarePen },
};

type MovementRowProps = {
  movement: MovementRowData;
  unit: InventoryUnit;
  first: boolean;
  /** The item's name, in the log that mixes items. */
  itemName?: string;
  /** This is the item's first movement ever, so a count is its opening one. */
  isFirstEver?: boolean;
  /** Leave the date out under a day heading. */
  showDate?: boolean;
};

/** One movement: what, how much, what a count worked out to, who and when. */
function MovementRow({
  movement,
  unit,
  first,
  itemName,
  isFirstEver = false,
  showDate = true,
}: MovementRowProps) {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const formatClock = useFormatClock();
  const formatQuantity = useFormatQuantity();
  const countInfo = useCountInfo();
  const { label, Icon } = KIND[movement.kind];

  const info =
    movement.waiting || movement.refused
      ? null
      : countInfo(
          {
            kind: movement.kind,
            derived_in: movement.derived_in,
            derived_out: movement.derived_out,
            balance_after: movement.balance_after ?? 0,
            quantity: movement.quantity,
          },
          unit,
          isFirstEver,
        );
  const when = `${showDate ? `${formatDay(movement.recorded_at.slice(0, 10), language)}, ` : ''}${formatClock(isoToClock(movement.recorded_at))}`;

  return (
    <View
      className={cn(
        'flex-row gap-3 px-4 py-3',
        !first && 'border-border border-t',
      )}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="border-border mt-0.5 size-9 shrink-0 items-center justify-center rounded-xl border"
      >
        <Icon className="text-foreground size-[18px]" />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="font-sans-semibold min-w-0 flex-1 text-[15px] leading-snug">
            {t(label)}
            {itemName ? (
              <Text className="font-sans-medium text-[15px]">{` · ${itemName}`}</Text>
            ) : null}
          </Text>
          <Text className="font-sans-semibold shrink-0 text-[15px]">
            {formatQuantity(movement.quantity, unit)}
          </Text>
        </View>

        {movement.waiting ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Clock className="text-pending-soft-foreground size-3.5 shrink-0" />
            <Text className="text-pending-soft-foreground font-sans-medium text-[13px]">
              {t('att.waiting')}
            </Text>
          </View>
        ) : movement.refused ? (
          <View className="mt-0.5 flex-row items-start gap-1">
            <CircleAlert className="text-destructive-soft-foreground mt-0.5 size-3.5 shrink-0" />
            <Text className="text-destructive-soft-foreground font-sans-medium min-w-0 flex-1 text-[13px] leading-snug">
              {`${t('inv.not-recorded')} · ${t('inv.refused-why')}`}
            </Text>
          </View>
        ) : info ? (
          <View className="mt-0.5 flex-row items-start gap-1">
            <Info className="text-foreground mt-0.5 size-3.5 shrink-0" />
            <Text className="font-sans-medium min-w-0 flex-1 text-[13px] leading-snug">
              {info}
            </Text>
          </View>
        ) : null}

        {movement.kind === 'ADD' && movement.unit_price !== null ? (
          <Text className="mt-0.5 text-[13px] leading-snug">
            {`₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(movement.unit_price)} ${format(t('inv.per-unit'), { unit: t(`inv.u.${unit}` as MessageKey) })}`}
          </Text>
        ) : null}
        <Text className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
          {`${movement.recorded_by} · ${when}`}
        </Text>
        {movement.note ? (
          <Text className="mt-1 text-[14px] leading-snug">{movement.note}</Text>
        ) : null}
      </View>
    </View>
  );
}

export { MovementRow };
