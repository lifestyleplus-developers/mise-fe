import type { MeResponse } from '@/shared/api/types';
import { canAdminister } from '@/shared/constants/roles';
import type { MessageKey } from '@/shared/i18n';
import type { Href } from 'expo-router';
import {
  ArrowLeftRight,
  ChartColumn,
  ClipboardCheck,
  History,
  Package,
  ScanSearch,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

export type ModuleRow = {
  id: string;
  icon: LucideIcon;
  label: MessageKey;
  href: Href;
};

export type ModuleGroup = {
  id: 'attendance' | 'inventory' | 'spotChecks';
  /** Null for a group of one row, which needs no heading above it. */
  heading: MessageKey | null;
  rows: ModuleRow[];
};

/**
 * The Modules hub: what each person can open, from `/auth/me` alone (FE Spec §2).
 * A module that is off does not exist (§1), so its entries are left out rather
 * than disabled, and a group with no entries is not drawn.
 *
 * Attendance is on when an outlet has it; Inventory when the business does. A
 * person gets in as a manager of it (a membership row) or as ADMIN or OWNER.
 * Configuration is the administrators' alone.
 */
export function moduleGroups(me: MeResponse): ModuleGroup[] {
  const admin = canAdminister(me.user.tenant_role);
  const { modules, memberships } = me;

  const attendanceOn = modules.attendance_outlets.length > 0;
  const attendanceManager = memberships.attendance_configs.length > 0;
  const attendanceReader = attendanceOn && (attendanceManager || admin);

  const inventoryOn = modules.inventory;
  const inventoryReader =
    inventoryOn && (memberships.inventory_outlets.length > 0 || admin);

  const spotChecksReader =
    modules.spot_check_outlets.length > 0 &&
    (memberships.spot_check_outlets.length > 0 || admin);

  const attendance: ModuleRow[] = [
    ...(attendanceOn && attendanceManager
      ? [
          {
            id: 'marking',
            icon: ClipboardCheck,
            label: 'modules.marking' as const,
            href: '/attendance' as const,
          },
        ]
      : []),
    ...(attendanceReader
      ? [
          {
            id: 'history',
            icon: History,
            label: 'modules.history' as const,
            href: '/attendance/history' as const,
          },
          {
            id: 'roster',
            icon: Users,
            label: 'modules.roster' as const,
            href: '/attendance/roster' as const,
          },
        ]
      : []),
    ...(attendanceOn && admin
      ? [
          {
            id: 'configs',
            icon: SlidersHorizontal,
            label: 'modules.configs' as const,
            href: '/attendance/configs' as const,
          },
        ]
      : []),
  ];

  const inventory: ModuleRow[] = inventoryReader
    ? [
        {
          id: 'items',
          icon: Package,
          label: 'modules.items',
          href: '/inventory',
        },
        {
          id: 'log',
          icon: ArrowLeftRight,
          label: 'modules.log',
          href: '/inventory/log',
        },
        {
          id: 'reports',
          icon: ChartColumn,
          label: 'modules.reports',
          href: '/inventory/reports',
        },
      ]
    : [];

  const spotChecks: ModuleRow[] = spotChecksReader
    ? [
        {
          id: 'spot-checks',
          icon: ScanSearch,
          label: 'modules.spot-checks',
          href: '/spot-checks',
        },
      ]
    : [];

  const groups: ModuleGroup[] = [
    { id: 'attendance', heading: 'modules.attendance', rows: attendance },
    { id: 'inventory', heading: 'modules.inventory', rows: inventory },
    { id: 'spotChecks', heading: null, rows: spotChecks },
  ];
  return groups.filter((group) => group.rows.length > 0);
}
