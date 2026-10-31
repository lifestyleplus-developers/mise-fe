import { useFormatQuantity } from '@/features/inventory/format';
import type { InventoryMovement, InventoryUnit } from '@/shared/api/types';
import { format, useT } from '@/shared/i18n';
import { useCallback } from 'react';

/**
 * The line a movement carries under its name: what a count worked out to. A count
 * above the balance is stock that arrived unrecorded, shown as information (not as
 * an error); a first count is the opening one.
 */
export function useCountInfo() {
  const t = useT();
  const formatQuantity = useFormatQuantity();
  return useCallback(
    (
      movement: Pick<
        InventoryMovement,
        'kind' | 'derived_in' | 'derived_out' | 'balance_after' | 'quantity'
      >,
      unit: InventoryUnit,
      isFirst: boolean,
    ): string | null => {
      if (movement.kind !== 'COUNT') return null;
      if (isFirst && movement.derived_in !== null)
        return t('inv.opening-count');
      if (movement.derived_in !== null) {
        return format(t('inv.arrived'), {
          q: formatQuantity(movement.derived_in, unit),
        });
      }
      if (movement.derived_out !== null) {
        return format(t('inv.out'), {
          q: formatQuantity(movement.derived_out, unit),
        });
      }
      return t('inv.no-change');
    },
    [t, formatQuantity],
  );
}
