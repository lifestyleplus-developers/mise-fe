import type { InventoryUnit } from '@/shared/api/types';
import { useT, type MessageKey } from '@/shared/i18n';
import { useCallback } from 'react';

/** Litres and kilograms keep two decimals; grams, millilitres and counts are whole. */
const FRACTION_DIGITS: Record<InventoryUnit, number> = {
  KG: 2,
  L: 2,
  G: 0,
  ML: 0,
  COUNT: 0,
};

/** Digits only: stock quantities are not localised (Model §15), and "−" marks a deficit. */
export function formatNumber(value: number, unit: InventoryUnit): string {
  const text = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: FRACTION_DIGITS[unit],
  }).format(Math.abs(value));
  return value < 0 ? `−${text}` : text;
}

/** "12.5 kg", "−2 l", "240 count": a quantity with its unit in the person's language. */
export function useFormatQuantity() {
  const t = useT();
  return useCallback(
    (value: number, unit: InventoryUnit) =>
      `${formatNumber(value, unit)} ${t(`inv.u.${unit}` as MessageKey)}`,
    [t],
  );
}

export const UNITS: readonly InventoryUnit[] = ['KG', 'G', 'L', 'ML', 'COUNT'];
