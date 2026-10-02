/** `user.tenant_role`: OWNER · ADMIN · MEMBER. CL_ADMIN and CL_IMP are assignment memberships, not roles here. */
export const ROLE = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

/** OWNER and ADMIN are the authoring tier — everything below sees less. */
export function canAdminister(role: Role): boolean {
  return role === ROLE.OWNER || role === ROLE.ADMIN;
}
