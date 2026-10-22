/**
 * Query keys for authored checklists, in one place because three features
 * read and invalidate them. `['checklists']` is every list (the tab and the
 * admin list); the rest hang off one checklist or one assignment.
 */
export const checklistKeys = {
  lists: ['checklists'] as const,
  detail: (id: number) => ['checklist', id] as const,
  tasks: (id: number) => ['checklist', id, 'tasks'] as const,
  assignments: (id: number) => ['checklist', id, 'assignments'] as const,
  members: (assignmentId: number) =>
    ['assignment', assignmentId, 'members'] as const,
};
