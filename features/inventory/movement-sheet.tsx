import { formatNumber } from '@/features/inventory/format';
import type {
  InventoryItem,
  InventoryMovementKind,
  InventoryUnit,
  RecordMovementRequest,
} from '@/shared/api/types';
import { FormSheet } from '@/shared/components/form-sheet';
import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { Info, Minus, Plus } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/** Decimal places a quantity may carry: litres and kilograms two, the rest whole. */
const DECIMALS: Record<InventoryUnit, number> = {
  KG: 2,
  L: 2,
  G: 0,
  ML: 0,
  COUNT: 0,
};

/** How far More and Less move: a hundred grams or millilitres, otherwise one. */
const STEP: Record<InventoryUnit, number> = {
  KG: 1,
  L: 1,
  G: 100,
  ML: 100,
  COUNT: 1,
};

type MovementSheetProps = {
  kind: InventoryMovementKind;
  item: InventoryItem;
  /** The item has nothing recorded yet, so a count is its opening one. */
  isFirst: boolean;
  onSave: (request: RecordMovementRequest) => void;
  onClose: () => void;
};

/** "12,5" and "12.5" both read; anything else is not a number. */
function parse(text: string): number | null {
  if (!text.trim()) return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/**
 * The sheet for Set actual, Add and Remove. Set actual takes what is left: usage is
 * worked out from it, never typed, and a count above the balance reads as stock
 * that arrived unrecorded (information, not an error). The balance can go below zero
 * on a Remove; the sheet says so but does not stop it.
 */
function MovementSheet({
  kind,
  item,
  isFirst,
  onSave,
  onClose,
}: MovementSheetProps) {
  const t = useT();
  const unitLabel = t(`inv.u.${item.unit}` as MessageKey);
  const decimals = DECIMALS[item.unit];
  const [text, setText] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [note, setNote] = React.useState('');
  const [noting, setNoting] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const quantity = parse(text);
  const valid =
    quantity !== null && (kind === 'COUNT' ? quantity >= 0 : quantity > 0);
  const priceValue = parse(price);
  const priceInvalid =
    price.trim() !== '' && (priceValue === null || priceValue < 0);

  const title =
    kind === 'COUNT'
      ? t(isFirst ? 'inv.opening-count' : 'inv.set-actual')
      : kind === 'ADD'
        ? t('inv.add-btn')
        : `${t('inv.remove-btn')} · ${t('inv.taken-out')}`;

  /** Keeps only digits and, where the unit allows, one decimal separator. */
  function clean(input: string): string {
    const kept = input.replace(/[^0-9.,]/g, '');
    if (decimals === 0) return kept.replace(/[.,].*$/, '');
    const at = kept.search(/[.,]/);
    if (at < 0) return kept;
    return (
      kept.slice(0, at + 1) +
      kept
        .slice(at + 1)
        .replace(/[.,]/g, '')
        .slice(0, decimals)
    );
  }

  function step(direction: 1 | -1) {
    const next = Math.max(
      0,
      Math.round(((quantity ?? 0) + direction * STEP[item.unit]) * 100) / 100,
    );
    setText(String(next));
    setTouched(true);
  }

  const n = (value: number) => `${formatNumber(value, item.unit)} ${unitLabel}`;
  let live: string | null = null;
  if (quantity !== null) {
    if (kind === 'COUNT') {
      const difference = Math.round((quantity - item.balance) * 1000) / 1000;
      live = isFirst
        ? format(t('inv.live-first'), {
            from: n(item.balance),
            to: n(quantity),
          })
        : difference > 0
          ? format(t('inv.live-above'), {
              from: n(item.balance),
              to: n(quantity),
              in: n(difference),
            })
          : difference < 0
            ? format(t('inv.live-below'), {
                from: n(item.balance),
                to: n(quantity),
                out: n(-difference),
              })
            : format(t('inv.live-same'), {
                from: n(item.balance),
                to: n(quantity),
              });
    } else if (kind === 'REMOVE' && quantity > item.balance) {
      live = format(t('inv.remove-above'), {
        to: n(Math.round((item.balance - quantity) * 1000) / 1000),
      });
    }
  }

  function save() {
    if (!valid || priceInvalid || quantity === null) return;
    onSave({
      kind,
      quantity,
      ...(kind === 'ADD' ? { unit_price: priceValue } : {}),
      note: note.trim() || null,
    });
  }

  return (
    <FormSheet
      visible
      title={title}
      onClose={onClose}
      onSubmit={save}
      submitDisabled={!valid || priceInvalid}
    >
      <View className="gap-1.5">
        <Text className="font-sans-semibold text-[13px]">
          {t(kind === 'COUNT' ? 'inv.count-label' : 'inv.qty-label')}
        </Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('inv.step-down')}
            onPress={() => step(-1)}
            className="border-input-edge bg-card active:bg-accent size-12 shrink-0 items-center justify-center rounded-2xl border"
          >
            <Minus className="text-foreground size-5" />
          </Pressable>
          <View className="min-w-0 flex-1 justify-center">
            <Input
              autoFocus
              value={text}
              keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
              accessibilityLabel={t(
                kind === 'COUNT' ? 'inv.count-label' : 'inv.qty-label',
              )}
              aria-invalid={
                touched &&
                kind !== 'COUNT' &&
                quantity !== null &&
                quantity <= 0
              }
              className="font-sans-semibold pr-16 text-[18px]"
              onChangeText={(value) => {
                setText(clean(value));
                setTouched(true);
              }}
            />
            <Text pointerEvents="none" className="absolute right-4 text-[15px]">
              {unitLabel}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('inv.step-up')}
            onPress={() => step(1)}
            className="border-input-edge bg-card active:bg-accent size-12 shrink-0 items-center justify-center rounded-2xl border"
          >
            <Plus className="text-foreground size-5" />
          </Pressable>
        </View>
        {decimals === 0 ? (
          <Text className="px-1 text-[13px] leading-snug">
            {t('inv.whole-hint')}
          </Text>
        ) : null}
        {touched && kind !== 'COUNT' && quantity !== null && quantity <= 0 ? (
          <Text
            accessibilityRole="alert"
            className="text-destructive-soft-foreground font-sans-medium px-1 text-[13px] leading-snug"
          >
            {t('inv.zero-err')}
          </Text>
        ) : null}
        {live ? (
          <View
            accessibilityLiveRegion="polite"
            className="border-input-edge bg-card mt-1 flex-row items-start gap-2 rounded-2xl border px-3 py-2.5"
          >
            <Info className="text-foreground mt-0.5 size-4 shrink-0" />
            <Text className="font-sans-medium min-w-0 flex-1 text-[14px] leading-snug">
              {live}
            </Text>
          </View>
        ) : null}
      </View>

      {kind === 'ADD' ? (
        <View>
          <TextField
            label={t('inv.unit-price')}
            value={price}
            keyboardType="decimal-pad"
            // The reference price is a hint to type over, never filled in for them.
            placeholder={
              item.reference_price !== null ? String(item.reference_price) : '0'
            }
            aria-invalid={priceInvalid}
            onChangeText={(value) => setPrice(value.replace(/[^0-9.,]/g, ''))}
          />
          <Text className="text-muted-foreground mt-1 px-1 text-[12px] leading-snug">
            {`₹ ${format(t('inv.per-unit'), { unit: unitLabel })}`}
          </Text>
        </View>
      ) : null}

      {noting ? (
        <TextField
          label={t('inv.note')}
          value={note}
          maxLength={500}
          onChangeText={(value) => setNote(value.replace(/[\r\n]+/g, ' '))}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setNoting(true)}
          className="active:bg-accent min-h-11 self-start justify-center rounded-full px-1"
        >
          <Text className="font-sans-semibold text-[14px] underline">
            {t('inv.add-note')}
          </Text>
        </Pressable>
      )}
    </FormSheet>
  );
}

export { MovementSheet };
