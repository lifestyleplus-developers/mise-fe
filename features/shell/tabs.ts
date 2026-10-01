import type { MeResponse } from '@/shared/api/types';
import { canAdminister } from '@/shared/constants/roles';
import type { MessageKey } from '@/shared/i18n';
import {
  Flag,
  House,
  LayoutGrid,
  ListChecks,
  Menu,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * The tab bar's entries. The ids are also the route names under
 * `app/(tabs)/`, which is how the bar maps a route to its icon and label.
 * Order is display order (FE Spec §2).
 */
export const TAB = {
  HOME: 'home',
  CHECKLISTS: 'checklists',
  ISSUES: 'issues',
  MODULES: 'modules',
  MORE: 'more',
} as const;

export type TabId = (typeof TAB)[keyof typeof TAB];

export const TAB_ORDER: readonly TabId[] = [
  TAB.HOME,
  TAB.CHECKLISTS,
  TAB.ISSUES,
  TAB.MODULES,
  TAB.MORE,
];

export const TAB_ICON: Record<TabId, LucideIcon> = {
  home: House,
  checklists: ListChecks,
  issues: Flag,
  modules: LayoutGrid,
  more: Menu,
};

export const TAB_LABEL: Record<TabId, MessageKey> = {
  home: 'tab.home',
  checklists: 'tab.checklists',
  issues: 'tab.issues',
  modules: 'tab.modules',
  more: 'tab.more',
};

/**
 * Whether the person has any module to open — one the business has switched
 * on for an outlet (or at all, for inventory) *and* a role in it. ADMIN and
 * OWNER see every enabled module without holding a membership row (Schema:
 * module configuration is theirs). Per-module rows come with the Modules
 * screen; the tab only needs to know there is at least one.
 */
function hasVisibleModule({ modules, memberships, user }: MeResponse) {
  const admin = canAdminister(user.role);
  return (
    (modules.attendance_outlets.length > 0 &&
      (memberships.attendance_configs.length > 0 || admin)) ||
    (modules.inventory &&
      (memberships.inventory_outlets.length > 0 || admin)) ||
    (modules.spot_check_outlets.length > 0 &&
      (memberships.spot_check_outlets.length > 0 || admin))
  );
}

/**
 * Which tabs this person sees. Built from what /auth/me returned — modules
 * and memberships — not inferred from the role name (API Contract §2), apart
 * from ADMIN/OWNER standing in for the supervisor membership on Issues. A
 * tab that does not apply is absent, not disabled (FE Spec §1).
 */
export function visibleTabs(me: MeResponse): TabId[] {
  const visible: Record<TabId, boolean> = {
    home: true,
    checklists: true,
    issues:
      me.memberships.cl_admin_assignments.length > 0 ||
      canAdminister(me.user.role),
    modules: hasVisibleModule(me),
    more: true,
  };
  return TAB_ORDER.filter((id) => visible[id]);
}
