import { useMe } from '@/features/auth/use-me';
import { useOutlets } from '@/features/outlets/use-outlets';
import type { OutletOption } from '@/shared/components/outlet-picker';
import { canAdminister } from '@/shared/constants/roles';

/**
 * The outlets this person can open inventory at: every outlet of the business for an
 * ADMIN or OWNER, and the outlets they are an Inventory Manager at for anyone else.
 * In the order the business made them.
 */
export function useInventoryOutlets() {
  const { data: me } = useMe();
  const outlets = useOutlets();
  const admin = me ? canAdminister(me.user.tenant_role) : false;
  const managed = new Set(me?.memberships.inventory_outlets ?? []);

  const list: OutletOption[] = (outlets.data ?? [])
    .filter(
      (outlet) => !outlet.is_archived && (admin || managed.has(outlet.id)),
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
