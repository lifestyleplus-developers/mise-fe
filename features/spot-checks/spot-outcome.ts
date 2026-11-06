import { effectiveOutcome } from '@/shared/lib/spot-outcome';
import type {
  SpotCheckCompletion,
  SpotCheckOutcome,
  SpotCheckResult,
  SpotCheckRun,
} from '@/shared/api/types';

/** The name of a run's subject: authored content, shown as stored. */
export function subjectName(run: SpotCheckRun): string {
  if (!run.subject) return '';
  return run.subject.type === 'STAFF'
    ? run.subject.full_name
    : run.subject.name;
}

/** What the badge can say: the four outcomes, and "Not done" for a run that never got photos. */
export type OutcomeKind = SpotCheckOutcome | 'NOT_DONE';

export { effectiveOutcome };

/** A result still waiting on a person: needs review and no override yet. */
export function isReviewItem(
  result: Pick<SpotCheckResult, 'outcome' | 'overridden_to'>,
): boolean {
  return result.outcome === 'NEEDS_REVIEW' && result.overridden_to === null;
}

/** Counts across a run's results, by what each stands as now (an override counts as its override). */
export function tallyResults(
  results: Pick<SpotCheckResult, 'outcome' | 'overridden_to'>[],
) {
  const tally = { passed: 0, failed: 0, review: 0, overridden: 0, pending: 0 };
  for (const result of results) {
    if (result.overridden_to !== null) tally.overridden += 1;
    switch (effectiveOutcome(result)) {
      case 'PASS':
        tally.passed += 1;
        break;
      case 'FAIL':
        tally.failed += 1;
        break;
      case 'NEEDS_REVIEW':
        tally.review += 1;
        break;
      case 'PENDING_JUDGEMENT':
        tally.pending += 1;
        break;
    }
  }
  return tally;
}

/** The badge for a run as a whole when it has no results to show: only "Not done". */
export function runOutcomeKind(
  completion: SpotCheckCompletion | null,
): OutcomeKind | null {
  return completion === 'NOT_DONE' ? 'NOT_DONE' : null;
}
