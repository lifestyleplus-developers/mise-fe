import type { IncidentStatus } from '@/shared/api/types';

/** What the Issues list is showing: open or resolved, optionally one outlet or checklist. */
export type IssueFilters = {
  status: IncidentStatus;
  outletId?: number;
  checklistId?: number;
};

/** Query keys for incidents; `['incidents']` is all of them. */
export const issueKeys = {
  all: ['incidents'] as const,
  lists: ['incidents', 'list'] as const,
  list: (filters: IssueFilters) => ['incidents', 'list', filters] as const,
  /** Where the two filter chips get their choices. */
  options: ['incidents', 'options'] as const,
  detail: (id: number) => ['incidents', 'detail', id] as const,
};

/**
 * The mutation key of "Mark resolved". The list reads the writes still waiting
 * under it ("Resolved · waiting to send"); the detail screen defines the mutation.
 */
export const RESOLVE_KEY = ['incidents', 'resolve'] as const;

/** What a queued resolve carries, so the list can find its card. */
export type ResolveVariables = { incidentId: number };
