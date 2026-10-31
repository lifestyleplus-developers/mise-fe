import { UNITS } from '@/features/inventory/format';
import {
  classifyItemError,
  itemMessage,
} from '@/features/inventory/item-errors';
import {
  useCreateInventoryItem,
  useUpdateInventoryItem,
} from '@/features/inventory/use-inventory-items';
import { api } from '@/shared/api/client';
import type { InventoryItem, InventoryUnit } from '@/shared/api/types';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { FilterChips } from '@/shared/components/filter-chips';
import { FormSheet } from '@/shared/components/form-sheet';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useQuery } from '@tanstack/react-query';
import { Archive } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type ItemSheetProps = {
  /** The item being edited; none to add one. */
  item?: InventoryItem;
  outletId: number;
  outletName: string;
  /** More than one outlet: a duplicate names the outlet. */
  multiOutlet: boolean;
  onClose: () => void;
  onAdded: (item: InventoryItem) => void;
  onArchived: (item: InventoryItem) => void;
  /** The platform refused the role (403) or the item is gone (404). */
  onLost: (kind: 'forbidden' | 'gone') => void;
};

/** A price typed with a comma or a point; empty is "no reference price". */
function parsePrice(text: string): number | null | 'invalid' {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : 'invalid';
}

/**
 * Add item / Edit item. A unit is chosen when the item is made and is fixed once
 * there are movements. The platform does not say whether an item has any, so the
 * sheet asks for its first one, and keeps the unit locked until it knows.
 */
function ItemSheet({
  item,
  outletId,
  outletName,
  multiOutlet,
  onClose,
  onAdded,
  onArchived,
  onLost,
}: ItemSheetProps) {
  const t = useT();
  const isNew = item === undefined;
  const create = useCreateInventoryItem();
  const update = useUpdateInventoryItem(item?.id ?? 0);

  const [name, setName] = React.useState(item?.name ?? '');
  const [unit, setUnit] = React.useState<InventoryUnit | ''>(item?.unit ?? '');
  const [price, setPrice] = React.useState(
    item?.reference_price != null ? String(item.reference_price) : '',
  );
  const [confirmingArchive, setConfirmingArchive] = React.useState(false);

  const movements = useQuery({
    queryKey: ['inventory', 'has-movements', item?.id],
    queryFn: () =>
      api.inventory.movements({ itemId: item!.id, page: 1, pageSize: 1 }),
    enabled: !isNew,
  });
  // Locked until the platform has said there is nothing recorded.
  const unitLocked = !isNew && (movements.data?.count ?? 1) > 0;

  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const failure = error ? classifyItemError(error) : null;
  const parsedPrice = parsePrice(price);
  const canSave =
    name.trim().length > 0 && unit !== '' && parsedPrice !== 'invalid';

  function reset() {
    create.reset();
    update.reset();
  }

  function fail(caught: unknown) {
    const kind = classifyItemError(caught);
    if (kind === 'forbidden' || kind === 'gone') {
      onClose();
      onLost(kind);
    }
  }

  function save() {
    if (!canSave || pending) return;
    // `canSave` has ruled out 'invalid'.
    const reference_price = parsedPrice as number | null;
    if (isNew) {
      create.mutate(
        {
          outlet_id: outletId,
          name: name.trim(),
          unit: unit as InventoryUnit,
          reference_price,
        },
        { onSuccess: onAdded, onError: fail },
      );
    } else {
      update.mutate(
        {
          name: name.trim(),
          reference_price,
          ...(unit !== item.unit ? { unit: unit as InventoryUnit } : {}),
        },
        { onSuccess: () => onClose(), onError: fail },
      );
    }
  }

  function archive() {
    setConfirmingArchive(false);
    update.mutate(
      { is_archived: true },
      { onSuccess: onArchived, onError: fail },
    );
  }

  return (
    <>
      <FormSheet
        visible={!confirmingArchive}
        title={t(isNew ? 'inv.add-title' : 'inv.edit-title')}
        onClose={onClose}
        onSubmit={save}
        isSubmitting={pending}
        submitDisabled={!canSave}
      >
        {failure === 'rejected' ? (
          <Banner tone="error" message={itemMessage(error) ?? ''} />
        ) : failure === 'unit-locked' ? (
          <Banner
            tone="error"
            message={format(t('inv.unit-locked'), {
              unit: t(`inv.u.${item?.unit ?? 'KG'}` as MessageKey),
            })}
          />
        ) : failure === 'failed' || failure === 'forbidden' ? (
          <Banner
            tone="error"
            message={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        ) : null}

        <View>
          <TextField
            label={t('inv.name')}
            value={name}
            editable={!pending}
            aria-invalid={failure === 'duplicate'}
            className={
              failure === 'duplicate' ? 'border-destructive' : undefined
            }
            onChangeText={(value) => {
              setName(value.replace(/[\r\n]+/g, ' '));
              reset();
            }}
          />
          {failure === 'duplicate' ? (
            <Text
              accessibilityRole="alert"
              className="text-destructive-soft-foreground font-sans-medium mt-1.5 px-1 text-[13px]"
            >
              {multiOutlet
                ? format(t('inv.dup'), {
                    outlet: outletName,
                    name: name.trim(),
                  })
                : format(t('inv.dup-single'), { name: name.trim() })}
            </Text>
          ) : null}
        </View>

        <View className="gap-1.5">
          <Text className="font-sans-semibold text-[13px]">
            {t('inv.unit')}
          </Text>
          {unitLocked && unit !== '' ? (
            <Text className="bg-muted font-sans-medium rounded-2xl px-4 py-3 text-[15px] leading-snug">
              {format(t('inv.unit-locked'), {
                unit: t(`inv.u.${unit}` as MessageKey),
              })}
            </Text>
          ) : (
            <>
              <FilterChips<InventoryUnit | ''>
                label={t('inv.unit')}
                value={unit}
                onChange={(next) => {
                  if (!pending) setUnit(next);
                  reset();
                }}
                options={UNITS.map((value) => ({
                  value,
                  label: t(`inv.u.${value}` as MessageKey),
                }))}
              />
              {unit === '' ? (
                <Text className="text-muted-foreground px-1 text-[12px] leading-snug">
                  {t('inv.unit-hint')}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View>
          <TextField
            label={t('inv.price')}
            value={price}
            editable={!pending}
            keyboardType="decimal-pad"
            placeholder="0"
            aria-invalid={parsedPrice === 'invalid'}
            onChangeText={(value) => {
              setPrice(value.replace(/[^0-9.,]/g, ''));
              reset();
            }}
          />
          {unit !== '' ? (
            <Text className="text-muted-foreground mt-1 px-1 text-[12px] leading-snug">
              {format(t('inv.per-unit'), {
                unit: t(`inv.u.${unit}` as MessageKey),
              })}
            </Text>
          ) : null}
        </View>

        {isNew ? null : (
          <Button
            variant="outline"
            disabled={pending}
            className="border-destructive/50 w-full"
            onPress={() => setConfirmingArchive(true)}
          >
            <Archive className="text-destructive-soft-foreground size-[18px]" />
            <Text className="text-destructive-soft-foreground font-sans-semibold text-[15px]">
              {t('inv.archive-item')}
            </Text>
          </Button>
        )}
      </FormSheet>

      <ConfirmDialog
        visible={confirmingArchive}
        icon={Archive}
        tone="warning"
        title={format(t('inv.archive-title'), { name: item?.name ?? '' })}
        body={t('inv.archive-body')}
        safe={{
          label: t('admin.cancel'),
          onPress: () => setConfirmingArchive(false),
        }}
        other={{ label: t('inv.archive'), onPress: archive }}
      />
    </>
  );
}

export { ItemSheet };
