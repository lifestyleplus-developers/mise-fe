import { moduleGroups } from '@/features/shell/modules';
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

/** The tab bar's entries. */
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

/** Which tabs this person sees. */
export function visibleTabs(me: MeResponse): TabId[] {
  const visible: Record<TabId, boolean> = {
    home: true,
    checklists: true,
    issues:
      me.memberships.cl_admin_assignments.length > 0 ||
      canAdminister(me.user.tenant_role),
    modules: moduleGroups(me).length > 0,
    more: true,
  };
  return TAB_ORDER.filter((id) => visible[id]);
}
