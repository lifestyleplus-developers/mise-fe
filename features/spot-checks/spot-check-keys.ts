/** Query keys for areas, checks, managers and runs; `['spot-checks']` is all of it. */
export const spotCheckKeys = {
  all: ['spot-checks'] as const,
  areaLists: ['spot-checks', 'areas'] as const,
  areaList: (filters: { outletId?: number; includeArchived: boolean }) =>
    ['spot-checks', 'areas', filters] as const,
  checkLists: ['spot-checks', 'checks'] as const,
  checkList: (filters: { outletId?: number; includeArchived: boolean }) =>
    ['spot-checks', 'checks', filters] as const,
  check: (id: number) => ['spot-checks', 'check', id] as const,
  managers: (outletId: number) =>
    ['spot-checks', 'managers', outletId] as const,
  runLists: ['spot-checks', 'runs'] as const,
  runList: (filters: {
    state?: 'revealed' | 'scheduled' | 'closed';
    outletId?: number;
    outcome?: string;
  }) => ['spot-checks', 'runs', filters] as const,
  run: (id: number) => ['spot-checks', 'run', id] as const,
};
