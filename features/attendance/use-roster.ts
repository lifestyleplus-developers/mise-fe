import { useStaff } from '@/features/attendance/use-staff';
import type { Staff } from '@/shared/api/types';
import * as React from 'react';

export type RosterStatus = 'active' | 'inactive' | 'archived';

export type RosterPerson = Staff & { status: RosterStatus };

/** How someone stands at one outlet: archived is theirs everywhere, the rest is per outlet. */
export function statusAt(person: Staff, outletId: number): RosterStatus {
  if (person.is_archived) return 'archived';
  const link = person.outlets.find((o) => o.outlet_id === outletId);
  return link?.is_active ? 'active' : 'inactive';
}

type RosterFilters = {
  outletId: number | undefined;
  search: string;
  showDeactivated: boolean;
  showArchived: boolean;
};

/**
 * One outlet's roster. The platform's outlet filter lists only people active
 * there, so to show those taken off it the whole roster is asked for, every page,
 * and the rows with a place at this outlet are kept.
 */
export function useRoster({
  outletId,
  search,
  showDeactivated,
  showArchived,
}: RosterFilters) {
  const query = useStaff(
    {
      outletId: showDeactivated ? undefined : outletId,
      search,
      includeArchived: showArchived,
    },
    outletId !== undefined,
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  React.useEffect(() => {
    if (showDeactivated && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [showDeactivated, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const people: RosterPerson[] =
    outletId === undefined
      ? []
      : (query.data?.pages.flatMap((page) => page.results) ?? [])
          .filter(
            (person) =>
              !showDeactivated ||
              person.outlets.some((o) => o.outlet_id === outletId),
          )
          .map((person) => ({ ...person, status: statusAt(person, outletId) }));

  return {
    people,
    query,
    /** Still working through pages to find everyone taken off this outlet. */
    loadingAll: showDeactivated && Boolean(hasNextPage),
  };
}
