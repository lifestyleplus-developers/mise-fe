import { useMe } from '@/features/auth/use-me';
import { useOutlets } from '@/features/outlets/use-outlets';
import type { OutletOption } from '@/shared/components/outlet-picker';
import { canAdminister } from '@/shared/constants/roles';

/**
 * The outlets this person can open spot checks at: every outlet with them on for an
 * ADMIN or OWNER, and those they are a Spot-check Manager at for anyone else. In the
 * order the business made them. `/auth/me` already leaves out an outlet whose module
 * is off, so an outlet that was switched off drops out of the list.
 */
export function useSpotCheckOutlets() {
  const { data: me } = useMe();
  const outlets = useOutlets();
  const admin = me ? canAdminister(me.user.tenant_role) : false;
  const on = new Set(me?.modules.spot_check_outlets ?? []);
  const managed = new Set(me?.memberships.spot_check_outlets ?? []);

  const list: OutletOption[] = (outlets.data ?? [])
    .filter(
      (outlet) =>
        !outlet.is_archived &&
        on.has(outlet.id) &&
        (admin || managed.has(outlet.id)),
    )
    .map((outlet) => ({ id: outlet.id, name: outlet.name }))
    .sort((a, b) => a.id - b.id);

  return {
    outlets: list,
    admin,
    isPending: !me || outlets.isPending,
    isError: outlets.isError,
    isRefetching: outlets.isRefetching,
    refetch: () => void outlets.refetch(),
  };
}
