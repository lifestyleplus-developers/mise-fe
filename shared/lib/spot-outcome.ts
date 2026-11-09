import type { SpotCheckOutcome } from '@/shared/api/types';

/**
 * Where a result stands for scoring and for "does this need a person": the override
 * if there is one, otherwise what the assessment said. The assessment's own answer
 * is never replaced; it stays on the row beside the override (FE Spec §3.11).
 * One rule for the app and the mock, so the two cannot drift.
 */
export function effectiveOutcome(result: {
  outcome: SpotCheckOutcome;
  overridden_to: SpotCheckOutcome | null;
}): SpotCheckOutcome {
  return result.overridden_to ?? result.outcome;
}
