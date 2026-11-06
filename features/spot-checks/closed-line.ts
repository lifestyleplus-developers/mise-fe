import { format, type MessageKey } from '@/shared/i18n';

import type { ClosedSummary } from './capture-view';

/** How a closed run ended, in the card's own words. */
export function closedLine(
  summary: ClosedSummary,
  t: (key: MessageKey) => string,
): string {
  switch (summary.kind) {
    case 'none':
      return t('spot.closed-none');
    case 'partial':
      return format(t('spot.closed-partial'), {
        n: String(summary.sent),
        total: String(summary.total),
      });
    case 'partialFallback':
      return format(t('spot.partial-fallback'), {
        n: String(summary.sent),
        total: String(summary.total),
      });
    case 'done':
      return t('spot.closed-done');
  }
}
