import type { User } from '@/shared/api/types';
import { ROLE, type Role } from '@/shared/constants/roles';

type Viewer = { id: number; role: Role };

/** Roles the viewer may give: an Administrator can only create Members. */
export function assignableRoles(viewer: Viewer): Role[] {
  return viewer.role === ROLE.OWNER ? [ROLE.MEMBER, ROLE.ADMIN] : [ROLE.MEMBER];
}

/**
 * What the viewer may do to a person. The platform enforces the same rules;
 * this decides which controls to draw.
 */
export function userRules(viewer: Viewer, target: User) {
  const isSelf = target.id === viewer.id;
  const isOwner = target.role === ROLE.OWNER;
  const isPeerAdmin =
    viewer.role === ROLE.ADMIN && target.role === ROLE.ADMIN && !isSelf;
  const untouchable = isSelf || isOwner || isPeerAdmin;

  return {
    isSelf,
    canChangeRole:
      !untouchable && target.is_active && assignableRoles(viewer).length > 1,
    canDeactivate: !untouchable && target.is_active,
    canSetPassword:
      target.is_active &&
      !(isOwner && viewer.role !== ROLE.OWNER) &&
      !isPeerAdmin,
    note:
      isOwner && viewer.role !== ROLE.OWNER
        ? ('owner' as const)
        : isPeerAdmin
          ? ('peer-admin' as const)
          : null,
  };
}
