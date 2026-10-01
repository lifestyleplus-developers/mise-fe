/**
 * `user.tenant_role` — the schema's enum OWNER · ADMIN · MEMBER. CL_ADMIN and
 * CL_IMP are not here: they exist only as assignment memberships (Schema,
 * `assignment_member.role`), never as a user attribute.
 */
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
