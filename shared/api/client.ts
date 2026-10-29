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
  mockListCandidates,
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
  Candidate,
  CandidatesQuery,
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
  Team,
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

import { loginRequest, logoutRequest } from './auth-api';
import { ApiError, request as call, requestAll, USE_REAL_API } from './http';

export { ApiError };

/**
 * With `EXPO_PUBLIC_API_BASE_URL` set, calls go to the platform; left empty, the
 * app runs on the fixture mock. Runs, answers and photograph uploads have no
 * endpoints on the platform yet (Lamax, weeks 6 to 8): Home is empty and the rest
 * fail until they land.
 */
function notBuilt(endpoint: string): Promise<never> {
  return Promise.reject(
    new Error(`${endpoint} is not on the platform yet. Use the mock.`),
  );
}

export const api = {
  auth: {
    /** POST /auth/login */
    login(request: LoginRequest): Promise<LoginResponse> {
      return USE_REAL_API ? loginRequest(request) : mockLogin(request);
    },

    /** GET /auth/me — called on every launch; it drives navigation (§2). */
    me(): Promise<MeResponse> {
      return USE_REAL_API ? call<MeResponse>('/auth/me') : mockFetchMe();
    },

    /** PATCH /auth/me — returns the updated identity. */
    updateMe(request: UpdateMeRequest): Promise<MeResponse> {
      return USE_REAL_API
        ? call<MeResponse>('/auth/me', { method: 'PATCH', body: request })
        : mockUpdateMe(request);
    },

    /** POST /auth/logout */
    logout(): Promise<void> {
      return USE_REAL_API ? logoutRequest() : mockLogout();
    },
  },
  outlets: {
    /** GET /outlets?include_archived=true */
    list(): Promise<Outlet[]> {
      return USE_REAL_API
        ? requestAll<Outlet>('/outlets', { include_archived: true })
        : mockListOutlets();
    },

    /** GET /outlets/{id} */
    get(id: number): Promise<Outlet> {
      return USE_REAL_API ? call<Outlet>(`/outlets/${id}`) : mockGetOutlet(id);
    },

    /** POST /outlets */
    create(request: CreateOutletRequest): Promise<Outlet> {
      return USE_REAL_API
        ? call<Outlet>('/outlets', { method: 'POST', body: request })
        : mockCreateOutlet(request);
    },

    /** PATCH /outlets/{id} */
    update(id: number, request: UpdateOutletRequest): Promise<Outlet> {
      return USE_REAL_API
        ? call<Outlet>(`/outlets/${id}`, { method: 'PATCH', body: request })
        : mockUpdateOutlet(id, request);
    },

    /** POST /outlets/{id}/archive */
    archive(id: number): Promise<Outlet> {
      return USE_REAL_API
        ? call<Outlet>(`/outlets/${id}/archive`, { method: 'POST' })
        : mockArchiveOutlet(id);
    },
  },
  runs: {
    /** GET /runs — only what the caller may act on; closed runs never come back. */
    list(): Promise<Run[]> {
      return USE_REAL_API ? Promise.resolve<Run[]>([]) : mockListRuns();
    },

    /** GET /runs/{id} — the run with its tasks and answers. */
    get(id: number): Promise<RunDetail> {
      return USE_REAL_API ? notBuilt('GET /runs/{id}') : mockGetRun(id);
    },
  },
  runTasks: {
    /**
     * PATCH /run-tasks/{id} — one answer, written as it is given (§7). The
     * platform returns 409 `window_closed` outside the window, 403 for a
     * supervisor, and 400 `comment_required_on_failure` without a comment.
     */
    answer(id: number, request: AnswerTaskRequest): Promise<RunTask> {
      return USE_REAL_API
        ? notBuilt('PATCH /run-tasks/{id}')
        : mockAnswerTask(id, request);
    },
  },
  uploads: {
    /**
     * POST /uploads/sign — §8. The photo is PUT straight to storage, then the
     * object key is written against the run task.
     */
    sign(request: UploadSignRequest): Promise<UploadSignResponse> {
      return USE_REAL_API
        ? notBuilt('POST /uploads/sign')
        : mockSignUpload(request);
    },
  },
  checklists: {
    /**
     * GET /checklists?page=&page_size= — scoped to what the caller can see.
     * `archivedOnly` is the admin list's Archived filter: only archived checklists come
     * back, and the server applies it so no page is fetched just to be thrown away.
     * It is `?is_archived=true`; the Active view sends `?is_archived=false`.
     */
    list(
      page: number,
      pageSize: number,
      options?: { archivedOnly?: boolean },
    ): Promise<Page<ChecklistListItem>> {
      return USE_REAL_API
        ? call<Page<ChecklistListItem>>('/checklists', {
            query: {
              page,
              page_size: pageSize,
              is_archived: options?.archivedOnly ?? false,
            },
          })
        : mockListChecklists(page, pageSize, options);
    },

    /** GET /checklists/{id} — with its tasks. */
    get(id: number): Promise<ChecklistDetail> {
      return USE_REAL_API
        ? call<ChecklistDetail>(`/checklists/${id}`)
        : mockGetChecklist(id);
    },

    /** POST /checklists — ADMIN/OWNER. 409 `window_overlaps_next_period`. */
    create(request: CreateChecklistRequest): Promise<Checklist> {
      return USE_REAL_API
        ? call<Checklist>('/checklists', { method: 'POST', body: request })
        : mockCreateChecklist(request);
    },

    /** PATCH /checklists/{id} — name and schedule; applies to future runs only. */
    update(id: number, request: UpdateChecklistRequest): Promise<Checklist> {
      return USE_REAL_API
        ? call<Checklist>(`/checklists/${id}`, {
            method: 'PATCH',
            body: request,
          })
        : mockUpdateChecklist(id, request);
    },

    /** POST /checklists/{id}/archive */
    archive(id: number): Promise<Checklist> {
      return USE_REAL_API
        ? call<Checklist>(`/checklists/${id}/archive`, { method: 'POST' })
        : mockArchiveChecklist(id);
    },

    /** GET /checklists/{id}/tasks — ordered. */
    tasks(id: number): Promise<Task[]> {
      return USE_REAL_API
        ? requestAll<Task>(`/checklists/${id}/tasks`)
        : mockListTasks(id);
    },

    /** POST /checklists/{id}/tasks */
    createTask(id: number, request: CreateTaskRequest): Promise<Task> {
      return USE_REAL_API
        ? call<Task>(`/checklists/${id}/tasks`, {
            method: 'POST',
            body: request,
          })
        : mockCreateTask(id, request);
    },

    /** POST /checklists/{id}/tasks/reorder — every task id, once, in order. */
    reorderTasks(id: number, request: ReorderTasksRequest): Promise<Task[]> {
      return USE_REAL_API
        ? call<Task[]>(`/checklists/${id}/tasks/reorder`, {
            method: 'POST',
            body: request,
          })
        : mockReorderTasks(id, request);
    },

    /** GET /checklists/{id}/assignments — the outlets it runs or ran at. */
    assignments(id: number): Promise<OutletAssignment[]> {
      return USE_REAL_API
        ? requestAll<OutletAssignment>(`/checklists/${id}/assignments`)
        : mockListAssignments(id);
    },

    /** POST /checklists/{id}/assignments — bulk. */
    assign(
      id: number,
      request: CreateAssignmentsRequest,
    ): Promise<OutletAssignment[]> {
      return USE_REAL_API
        ? call<OutletAssignment[]>(`/checklists/${id}/assignments`, {
            method: 'POST',
            body: request,
          })
        : mockCreateAssignments(id, request);
    },
  },
  tasks: {
    /** PATCH /tasks/{id} — the answer type is fixed. */
    update(id: number, request: UpdateTaskRequest): Promise<Task> {
      return USE_REAL_API
        ? call<Task>(`/tasks/${id}`, { method: 'PATCH', body: request })
        : mockUpdateTask(id, request);
    },

    /** POST /tasks/{id}/archive */
    archive(id: number): Promise<void> {
      return USE_REAL_API
        ? call<Task>(`/tasks/${id}/archive`, { method: 'POST' }).then(
            () => undefined,
          )
        : mockArchiveTask(id);
    },
  },
  assignments: {
    /** DELETE /assignments/{id} — deactivates; history survives. */
    deactivate(id: number): Promise<void> {
      return USE_REAL_API
        ? call<void>(`/assignments/${id}`, { method: 'DELETE' })
        : mockDeactivateAssignment(id);
    },

    /**
     * GET /assignments/{id}/members — both buckets. Only for an admin or this
     * assignment's own supervisor (403 `not_your_assignment` otherwise).
     * `includeRemoved` adds `removed`: the people taken off, latest first.
     */
    members(id: number, options?: { includeRemoved?: boolean }): Promise<Team> {
      return USE_REAL_API
        ? call<Team>(`/assignments/${id}/members`, {
            query: { include_removed: options?.includeRemoved },
          })
        : mockListMembers(id, options);
    },

    /**
     * GET /assignments/{id}/candidates?search=&page=&page_size= — the people who
     * could be added: active, and not on the assignment. A Checklist Manager may
     * read this where they may not read /users.
     */
    candidates(id: number, query: CandidatesQuery): Promise<Page<Candidate>> {
      return USE_REAL_API
        ? call<Page<Candidate>>(`/assignments/${id}/candidates`, {
            query: {
              search: query.search,
              page: query.page,
              page_size: query.pageSize,
            },
          })
        : mockListCandidates(id, query);
    },

    /**
     * POST /assignments/{id}/members — 409 `role_conflict` if already on it in
     * the other role. Answers with the team as GET gives it.
     */
    addMember(id: number, request: AddMemberRequest): Promise<Team> {
      return USE_REAL_API
        ? call<Team>(`/assignments/${id}/members`, {
            method: 'POST',
            body: request,
          })
        : mockAddMember(id, request);
    },

    /** DELETE /assignments/{id}/members/{user_id} */
    removeMember(id: number, userId: number): Promise<void> {
      return USE_REAL_API
        ? call<void>(`/assignments/${id}/members/${userId}`, {
            method: 'DELETE',
          })
        : mockRemoveMember(id, userId);
    },
  },
  users: {
    /** GET /users?role=&is_active=&search=&page=&page_size= */
    list(query: UsersQuery): Promise<Page<User>> {
      return USE_REAL_API
        ? call<Page<User>>('/users', {
            query: {
              role: query.role,
              is_active: query.isActive,
              search: query.search,
              page: query.page,
              page_size: query.pageSize,
            },
          })
        : mockListUsers(query);
    },

    /** GET /users/{id} */
    get(id: number): Promise<User> {
      return USE_REAL_API ? call<User>(`/users/${id}`) : mockGetUser(id);
    },

    /** POST /users */
    create(request: CreateUserRequest): Promise<User> {
      return USE_REAL_API
        ? call<User>('/users', { method: 'POST', body: request })
        : mockCreateUser(request);
    },

    /** PATCH /users/{id} */
    update(id: number, request: UpdateUserRequest): Promise<User> {
      return USE_REAL_API
        ? call<User>(`/users/${id}`, { method: 'PATCH', body: request })
        : mockUpdateUser(id, request);
    },

    /** POST /users/{id}/reset-password */
    resetPassword(id: number, request: ResetPasswordRequest): Promise<void> {
      return USE_REAL_API
        ? call<void>(`/users/${id}/reset-password`, {
            method: 'POST',
            body: request,
          })
        : mockResetPassword(id, request);
    },
  },
} as const;
