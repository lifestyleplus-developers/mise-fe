/** The transport seam. */
import {
  mockAddMember,
  mockAnswerTask,
  mockArchiveChecklist,
  mockArchiveOutlet,
  mockArchiveTask,
  mockCreateAssignments,
  mockCreateChecklist,
  mockCreateOutlet,
  mockCreateTask,
  mockCreateUser,
  mockDeactivateAssignment,
  mockFetchMe,
  mockGetChecklist,
  mockGetOutlet,
  mockGetRun,
  mockGetUser,
  mockListAssignments,
  mockListChecklists,
  mockListMembers,
  mockListOutlets,
  mockListRuns,
  mockListTasks,
  mockListUsers,
  mockLogin,
  mockLogout,
  mockRemoveMember,
  mockReorderTasks,
  mockResetPassword,
  mockRestoreChecklist,
  mockSignUpload,
  mockUpdateChecklist,
  mockUpdateMe,
  mockUpdateOutlet,
  mockUpdateTask,
  mockUpdateUser,
} from '@/shared/mocks/mock-db';
import type {
  AddMemberRequest,
  AnswerTaskRequest,
  AssignmentMember,
  Checklist,
  ChecklistDetail,
  ChecklistListItem,
  CreateAssignmentsRequest,
  CreateChecklistRequest,
  CreateOutletRequest,
  CreateTaskRequest,
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  Outlet,
  OutletAssignment,
  Page,
  ReorderTasksRequest,
  ResetPasswordRequest,
  Run,
  RunDetail,
  RunTask,
  Task,
  UpdateChecklistRequest,
  UpdateMeRequest,
  UpdateOutletRequest,
  UpdateTaskRequest,
  UpdateUserRequest,
  User,
  UsersQuery,
  UploadSignRequest,
  UploadSignResponse,
} from './types';

export { MockApiError } from '@/shared/mocks/mock-db';

export const api = {
  auth: {
    /** POST /auth/login */
    login(request: LoginRequest): Promise<LoginResponse> {
      // TODO(server): POST {API_BASE_URL}/api/v1/auth/login
      return mockLogin(request);
    },

    /** GET /auth/me — called on every launch; it drives navigation (§2). */
    me(): Promise<MeResponse> {
      // TODO(server): GET {API_BASE_URL}/api/v1/auth/me
      return mockFetchMe();
    },

    /** PATCH /auth/me — returns the updated identity. */
    updateMe(request: UpdateMeRequest): Promise<MeResponse> {
      // TODO(server): PATCH {API_BASE_URL}/api/v1/auth/me
      return mockUpdateMe(request);
    },

    /** POST /auth/logout */
    logout(): Promise<void> {
      // TODO(server): POST {API_BASE_URL}/api/v1/auth/logout
      return mockLogout();
    },
  },
  outlets: {
    /** GET /outlets?include_archived=true */
    list(): Promise<Outlet[]> {
      // TODO(server): GET {API_BASE_URL}/api/v1/outlets?include_archived=true (paginated)
      return mockListOutlets();
    },

    /** GET /outlets/{id} */
    get(id: number): Promise<Outlet> {
      // TODO(server): GET {API_BASE_URL}/api/v1/outlets/{id}
      return mockGetOutlet(id);
    },

    /** POST /outlets */
    create(request: CreateOutletRequest): Promise<Outlet> {
      // TODO(server): POST {API_BASE_URL}/api/v1/outlets
      return mockCreateOutlet(request);
    },

    /** PATCH /outlets/{id} */
    update(id: number, request: UpdateOutletRequest): Promise<Outlet> {
      // TODO(server): PATCH {API_BASE_URL}/api/v1/outlets/{id}
      return mockUpdateOutlet(id, request);
    },

    /** POST /outlets/{id}/archive */
    archive(id: number): Promise<Outlet> {
      // TODO(server): POST {API_BASE_URL}/api/v1/outlets/{id}/archive
      return mockArchiveOutlet(id);
    },
  },
  runs: {
    /** GET /runs — only what the caller may act on; closed runs never come back. */
    list(): Promise<Run[]> {
      // TODO(server): GET {API_BASE_URL}/api/v1/runs (paginated)
      return mockListRuns();
    },

    /** GET /runs/{id} — the run with its tasks and answers. */
    get(id: number): Promise<RunDetail> {
      // TODO(server): GET {API_BASE_URL}/api/v1/runs/{id}
      return mockGetRun(id);
    },
  },
  runTasks: {
    /**
     * PATCH /run-tasks/{id} — one answer, written as it is given (§7). The
     * platform returns 409 `window_closed` outside the window, 403 for a
     * supervisor, and 400 `comment_required_on_failure` without a comment.
     */
    answer(id: number, request: AnswerTaskRequest): Promise<RunTask> {
      // TODO(server): PATCH {API_BASE_URL}/api/v1/run-tasks/{id}
      return mockAnswerTask(id, request);
    },
  },
  uploads: {
    /**
     * POST /uploads/sign — §8. The photo is PUT straight to storage, then the
     * object key is written against the run task.
     */
    sign(request: UploadSignRequest): Promise<UploadSignResponse> {
      // TODO(server): POST {API_BASE_URL}/api/v1/uploads/sign
      return mockSignUpload(request);
    },
  },
  checklists: {
    /**
     * GET /checklists?page=&page_size= — scoped to what the caller can see.
     * `includeArchived` is for the admin list's Archived filter.
     */
    list(
      page: number,
      pageSize: number,
      options?: { includeArchived?: boolean },
    ): Promise<Page<ChecklistListItem>> {
      // TODO(server): GET {API_BASE_URL}/api/v1/checklists
      return mockListChecklists(page, pageSize, options);
    },

    /** GET /checklists/{id} — with its tasks. */
    get(id: number): Promise<ChecklistDetail> {
      // TODO(server): GET {API_BASE_URL}/api/v1/checklists/{id}
      return mockGetChecklist(id);
    },

    /** POST /checklists — ADMIN/OWNER. 409 `window_overlaps_next_period`. */
    create(request: CreateChecklistRequest): Promise<Checklist> {
      // TODO(server): POST {API_BASE_URL}/api/v1/checklists
      return mockCreateChecklist(request);
    },

    /** PATCH /checklists/{id} — name and schedule; applies to future runs only. */
    update(id: number, request: UpdateChecklistRequest): Promise<Checklist> {
      // TODO(server): PATCH {API_BASE_URL}/api/v1/checklists/{id}
      return mockUpdateChecklist(id, request);
    },

    /** POST /checklists/{id}/archive */
    archive(id: number): Promise<Checklist> {
      // TODO(server): POST {API_BASE_URL}/api/v1/checklists/{id}/archive
      return mockArchiveChecklist(id);
    },

    /** POST /checklists/{id}/restore — not in the contract yet; see the mock. */
    restore(id: number): Promise<Checklist> {
      // TODO(server): POST {API_BASE_URL}/api/v1/checklists/{id}/restore
      return mockRestoreChecklist(id);
    },

    /** GET /checklists/{id}/tasks — ordered. */
    tasks(id: number): Promise<Task[]> {
      // TODO(server): GET {API_BASE_URL}/api/v1/checklists/{id}/tasks
      return mockListTasks(id);
    },

    /** POST /checklists/{id}/tasks */
    createTask(id: number, request: CreateTaskRequest): Promise<Task> {
      // TODO(server): POST {API_BASE_URL}/api/v1/checklists/{id}/tasks
      return mockCreateTask(id, request);
    },

    /** POST /checklists/{id}/tasks/reorder — every task id, once, in order. */
    reorderTasks(id: number, request: ReorderTasksRequest): Promise<Task[]> {
      // TODO(server): POST {API_BASE_URL}/api/v1/checklists/{id}/tasks/reorder
      return mockReorderTasks(id, request);
    },

    /** GET /checklists/{id}/assignments — the outlets it runs or ran at. */
    assignments(id: number): Promise<OutletAssignment[]> {
      // TODO(server): GET {API_BASE_URL}/api/v1/checklists/{id}/assignments
      return mockListAssignments(id);
    },

    /** POST /checklists/{id}/assignments — bulk. */
    assign(
      id: number,
      request: CreateAssignmentsRequest,
    ): Promise<OutletAssignment[]> {
      // TODO(server): POST {API_BASE_URL}/api/v1/checklists/{id}/assignments
      return mockCreateAssignments(id, request);
    },
  },
  tasks: {
    /** PATCH /tasks/{id} — the answer type is fixed. */
    update(id: number, request: UpdateTaskRequest): Promise<Task> {
      // TODO(server): PATCH {API_BASE_URL}/api/v1/tasks/{id}
      return mockUpdateTask(id, request);
    },

    /** POST /tasks/{id}/archive */
    archive(id: number): Promise<void> {
      // TODO(server): POST {API_BASE_URL}/api/v1/tasks/{id}/archive
      return mockArchiveTask(id);
    },
  },
  assignments: {
    /** DELETE /assignments/{id} — deactivates; history survives. */
    deactivate(id: number): Promise<void> {
      // TODO(server): DELETE {API_BASE_URL}/api/v1/assignments/{id}
      return mockDeactivateAssignment(id);
    },

    /**
     * GET /assignments/{id}/members — flat, supervisors first. Only for an
     * admin or this assignment's own supervisor (403 `not_your_assignment`
     * otherwise). `includeRemoved` adds the people taken off, latest first.
     */
    members(
      id: number,
      options?: { includeRemoved?: boolean },
    ): Promise<AssignmentMember[]> {
      // TODO(server): GET {API_BASE_URL}/api/v1/assignments/{id}/members?include_removed=
      return mockListMembers(id, options);
    },

    /**
     * POST /assignments/{id}/members — 409 `role_conflict` if already on it in
     * the other role. Answers with the team as GET gives it.
     */
    addMember(
      id: number,
      request: AddMemberRequest,
    ): Promise<AssignmentMember[]> {
      // TODO(server): POST {API_BASE_URL}/api/v1/assignments/{id}/members
      return mockAddMember(id, request);
    },

    /** DELETE /assignments/{id}/members/{user_id} */
    removeMember(id: number, userId: number): Promise<void> {
      // TODO(server): DELETE {API_BASE_URL}/api/v1/assignments/{id}/members/{user_id}
      return mockRemoveMember(id, userId);
    },
  },
  users: {
    /** GET /users?role=&is_active=&search=&page=&page_size= */
    list(query: UsersQuery): Promise<Page<User>> {
      // TODO(server): GET {API_BASE_URL}/api/v1/users
      return mockListUsers(query);
    },

    /** GET /users/{id} */
    get(id: number): Promise<User> {
      // TODO(server): GET {API_BASE_URL}/api/v1/users/{id}
      return mockGetUser(id);
    },

    /** POST /users */
    create(request: CreateUserRequest): Promise<User> {
      // TODO(server): POST {API_BASE_URL}/api/v1/users
      return mockCreateUser(request);
    },

    /** PATCH /users/{id} */
    update(id: number, request: UpdateUserRequest): Promise<User> {
      // TODO(server): PATCH {API_BASE_URL}/api/v1/users/{id}
      return mockUpdateUser(id, request);
    },

    /** POST /users/{id}/reset-password */
    resetPassword(id: number, request: ResetPasswordRequest): Promise<void> {
      // TODO(server): POST {API_BASE_URL}/api/v1/users/{id}/reset-password
      return mockResetPassword(id, request);
    },
  },
} as const;
