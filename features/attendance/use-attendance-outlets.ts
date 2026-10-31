import { useAttendanceConfigs } from '@/features/attendance/use-attendance-configs';
import { useMe } from '@/features/auth/use-me';
import { useOutlets } from '@/features/outlets/use-outlets';
import type { OutletOption } from '@/shared/components/outlet-picker';
import { canAdminister } from '@/shared/constants/roles';

/**
 * The outlets this person can open attendance at: every outlet with it on for an
 * ADMIN or OWNER, and the outlets of their configurations for a manager (who is
 * told nothing about the rest). In the order the business made them.
 */
export function useAttendanceOutlets() {
  const { data: me } = useMe();
  const outlets = useOutlets();
  const admin = me ? canAdminister(me.user.tenant_role) : false;
  const configs = useAttendanceConfigs(undefined, {
    enabled: me !== undefined && !admin,
  });

  const allowed = admin
    ? new Set(me?.modules.attendance_outlets ?? [])
    : new Set((configs.data ?? []).map((config) => config.outlet_id));

  const list: OutletOption[] = (outlets.data ?? [])
    .filter((outlet) => !outlet.is_archived && allowed.has(outlet.id))
    .map((outlet) => ({ id: outlet.id, name: outlet.name }))
    .sort((a, b) => a.id - b.id);

  return {
    outlets: list,
    isPending: !me || outlets.isPending || (!admin && configs.isPending),
    isError: outlets.isError || (!admin && configs.isError),
    error: outlets.error ?? configs.error,
    isRefetching: outlets.isRefetching || (!admin && configs.isRefetching),
    refetch: () => {
      void outlets.refetch();
      if (!admin) void configs.refetch();
    },
  };
}
