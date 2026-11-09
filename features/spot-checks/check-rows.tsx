import { FormSheet } from '@/shared/components/form-sheet';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { format, useT } from '@/shared/i18n';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  EllipsisVertical,
  Pencil,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { DEFAULT_WEIGHT, type DraftRow } from './check-form';
import { Stepper } from './stepper';

export type RowKind = 'prompt' | 'item';

type CheckRowListProps = {
  rows: readonly DraftRow[];
  kind: RowKind;
  /** Undefined: read-only, no ⋮. */
  onMenu?: (row: DraftRow) => void;
};

/**
 * The prompts or the items of a check, in order. A prompt leads with its number;
 * an item carries its weight under the text. Nothing on either row points at the
 * other kind: items are judged against every photo (FE Spec §3.11).
 */
export function CheckRowList({ rows, kind, onMenu }: CheckRowListProps) {
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <View className="shadow-card border-border bg-card mt-2 overflow-hidden rounded-3xl border">
      {rows.map((row, index) => (
        <View
          key={row.key}
          className={`min-h-14 flex-row items-center gap-3 px-4 py-2 ${
            index > 0 ? 'border-border border-t' : ''
          }`}
        >
          {kind === 'prompt' ? (
            <View
              accessibilityElementsHidden
              className="border-border size-7 shrink-0 items-center justify-center rounded-full border"
            >
              <Text className="font-sans-semibold text-[13px]">
                {index + 1}
              </Text>
            </View>
          ) : null}
          <View className="min-w-0 flex-1 py-1">
            <Text className="text-[15px] leading-snug">{row.text}</Text>
            {kind === 'item' ? (
              <Text className="text-muted-foreground text-[13px] leading-snug">
                {format(t('spot.weight'), { n: String(row.weight) })}
              </Text>
            ) : null}
          </View>
          {onMenu ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={format(t('spot.menu-for'), {
                name: row.text,
              })}
              onPress={() => onMenu(row)}
              className="active:bg-accent size-11 shrink-0 items-center justify-center rounded-full"
            >
              <EllipsisVertical className="text-foreground size-5" />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

type RowMenuSheetProps = {
  /** The row's own text: the sheet is titled with it. */
  title: string;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onArchive: () => void;
  onClose: () => void;
};

/** Edit, Move up, Move down, Archive: for one prompt or one item. */
export function RowMenuSheet({
  title,
  onEdit,
  onMoveUp,
  onMoveDown,
  onArchive,
  onClose,
}: RowMenuSheetProps) {
  const t = useT();
  const entries = [
    { Icon: Pencil, label: t('spot.edit'), onPress: onEdit },
    { Icon: ArrowUp, label: t('spot.move-up'), onPress: onMoveUp },
    { Icon: ArrowDown, label: t('spot.move-down'), onPress: onMoveDown },
    { Icon: Archive, label: t('spot.archive'), onPress: onArchive },
  ];
  return (
    <BottomSheet
      visible
      title={title}
      onDismiss={onClose}
      footer={
        <Button variant="outline" className="w-full" onPress={onClose}>
          <Text>{t('admin.cancel')}</Text>
        </Button>
      }
    >
      <View className="border-border overflow-hidden rounded-3xl border">
        {entries.map(({ Icon, label, onPress }, index) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            onPress={onPress}
            className={`active:bg-accent min-h-14 flex-row items-center gap-3 px-4 py-2 ${
              index > 0 ? 'border-border border-t' : ''
            }`}
          >
            <Icon className="text-foreground size-5 shrink-0" />
            <Text className="font-sans-medium text-[16px]">{label}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

type RowEditSheetProps = {
  kind: RowKind;
  /** The row being edited; none to add one. */
  row?: DraftRow;
  onSave: (text: string, weight: number) => void;
  onClose: () => void;
};

/** Add or edit one prompt, or one item with its weight (1 to 10, starting at 5). */
export function RowEditSheet({
  kind,
  row,
  onSave,
  onClose,
}: RowEditSheetProps) {
  const t = useT();
  const [text, setText] = React.useState(row?.text ?? '');
  const [weight, setWeight] = React.useState(row?.weight ?? DEFAULT_WEIGHT);
  const title = row
    ? t('spot.edit')
    : t(kind === 'prompt' ? 'spot.add-prompt' : 'spot.add-item');
  return (
    <FormSheet
      visible
      title={title}
      onClose={onClose}
      onSubmit={() => onSave(text.trim(), weight)}
      submitDisabled={text.trim().length === 0}
    >
      <TextField
        label={t(kind === 'prompt' ? 'spot.prompt-field' : 'spot.item-field')}
        value={text}
        autoFocus
        onChangeText={(value) => setText(value.replace(/[\r\n]+/g, ' '))}
      />
      {kind === 'item' ? (
        <>
          <Text className="-mt-1 px-1 text-[13px] leading-snug">
            {t('spot.item-hint')}
          </Text>
          <View className="gap-2">
            <Text className="font-sans-semibold text-[13px]">
              {t('spot.weight-label')}
            </Text>
            <Stepper
              display={String(weight)}
              lessLabel={t('spot.less-weight')}
              moreLabel={t('spot.more-weight')}
              lessDisabled={weight <= 1}
              moreDisabled={weight >= 10}
              onLess={() => setWeight((current) => current - 1)}
              onMore={() => setWeight((current) => current + 1)}
            />
          </View>
        </>
      ) : null}
    </FormSheet>
  );
}
