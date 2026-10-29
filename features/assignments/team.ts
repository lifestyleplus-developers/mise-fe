import type {
  AssignmentMember,
  AssignmentRole,
  Team,
  TeamPerson,
} from '@/shared/api/types';

/**
 * The platform answers with two buckets; the screens work on one list with a
 * role on each person. Managers come first, then team members, each by name.
 */
export function currentMembers(team: Team): AssignmentMember[] {
  const inBucket = (people: TeamPerson[], role: AssignmentRole) =>
    people.map((person): AssignmentMember => ({
      user_id: person.id,
      username: person.username,
      full_name: person.full_name,
      role,
      is_active: person.is_active,
      removed_at: null,
      removed_by: null,
    }));
  return [
    ...inBucket(team.cl_admins, 'CL_ADMIN'),
    ...inBucket(team.cl_imps, 'CL_IMP'),
  ];
}

/** The people taken off, latest first as the platform sends them. */
export function removedMembers(team: Team): AssignmentMember[] {
  return (team.removed ?? []).map((person) => ({
    user_id: person.id,
    username: person.username,
    full_name: person.full_name,
    role: person.role,
    is_active: person.is_active,
    removed_at: person.removed_at,
    removed_by: person.removed_by,
  }));
}
