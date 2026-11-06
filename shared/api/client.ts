/** The transport seam. */
import {
  mockAddMember,
  mockAnswerTask,
  mockAppointAttendanceManager,
  mockArchiveAttendanceConfig,
  mockArchiveChecklist,
  mockArchiveOutlet,
  mockArchiveTask,
  mockCreateAssignments,
  mockCreateAttendanceConfig,
  mockCreateChecklist,
  mockCreateInventoryItem,
  mockCreateOutlet,
  mockCreateStaff,
  mockCreateTask,
  mockCreateUser,
  mockDeactivateAssignment,
  mockEnrolStaff,
  mockFetchMe,
  mockGetAttendanceSession,
  mockGetChecklist,
  mockGetOutlet,
  mockGetRun,
  mockGetUser,
  mockListAssignments,
  mockListAttendanceConfigs,
  mockListAttendanceSessions,
  mockListCandidates,
  mockListChecklists,
  mockAppointInventoryManager,
  mockListInventoryItems,
  mockListInventoryManagers,
  mockRemoveInventoryManager,
  mockListInventoryMovements,
  mockListMembers,
  mockListOutlets,
  mockListRuns,
  mockListStaff,
  mockListTasks,
  mockListUsers,
  mockLogin,
  mockLogout,
  mockMarkPerson,
  mockRecordInventoryMovement,
  mockRemoveAttendanceManager,
  mockRemoveMember,
  mockReorderTasks,
  mockResetPassword,
  mockSignUpload,
  mockStockOnHandReport,
  mockStockSpendReport,
  mockStockSummaryReport,
  mockUpdateAttendanceConfig,
  mockUpdateChecklist,
  mockUpdateInventoryItem,
  mockUpdateMe,
  mockUpdateOutlet,
  mockUpdateStaff,
  mockUpdateTask,
  mockUpdateUser,
  mockListAreas,
  mockCreateArea,
  mockUpdateArea,
  mockListSpotChecks,
  mockGetSpotCheck,
  mockCreateSpotCheck,
  mockUpdateSpotCheck,
  mockAddSpotCheckCapture,
  mockUpdateSpotCheckCapture,
  mockRemoveSpotCheckCapture,
  mockAddSpotCheckAssertion,
  mockUpdateSpotCheckAssertion,
  mockListSpotCheckManagers,
  mockAppointSpotCheckManager,
  mockRemoveSpotCheckManager,
  mockListSpotCheckRuns,
  mockGetSpotCheckRun,
  mockSubmitSpotCheckPhoto,
  mockOverrideSpotCheckResult,
} from '@/shared/mocks/mock-db';
import type {
  AddMemberRequest,
  AnswerTaskRequest,
  AppointManagerRequest,
  AttendanceConfig,
  AttendanceConfigsQuery,
  AttendanceMark,
  AttendanceSession,
  AttendanceSessionDetail,
  AttendanceSessionsQuery,
  Candidate,
  CandidatesQuery,
  Checklist,
  ChecklistDetail,
  ChecklistListItem,
  CreateAssignmentsRequest,
  CreateAttendanceConfigRequest,
  CreateChecklistRequest,
  CreateInventoryItemRequest,
  CreateOutletRequest,
  CreateStaffRequest,
  CreateTaskRequest,
  CreateUserRequest,
  EnrolStaffRequest,
  InventoryItem,
  InventoryItemsQuery,
  InventoryManager,
  InventoryMovement,
  InventoryMovementsQuery,
  LoginRequest,
  LoginResponse,
  MarkPersonRequest,
  MeResponse,
  Outlet,
  OutletAssignment,
  Page,
  RecordMovementRequest,
  ReorderTasksRequest,
  ResetPasswordRequest,
  Run,
  RunDetail,
  RunTask,
  Staff,
  StaffQuery,
  StockOnHandReport,
  StockReportQuery,
  StockSpendReport,
  StockSummaryReport,
  Task,
  Team,
  UpdateAttendanceConfigRequest,
  UpdateChecklistRequest,
  UpdateInventoryItemRequest,
  UpdateMeRequest,
  UpdateOutletRequest,
  UpdateStaffRequest,
  UpdateTaskRequest,
  UpdateUserRequest,
  UploadSignRequest,
  UploadSignResponse,
  User,
  UsersQuery,
  Area,
  AreasQuery,
  CreateAreaRequest,
  CreateSpotCheckRequest,
  OverrideSpotCheckResultRequest,
  SpotCheck,
  SpotCheckAssertion,
  SpotCheckAssertionRequest,
  SpotCheckCapture,
  SpotCheckCaptureRequest,
  SpotCheckManager,
  SpotCheckResult,
  SpotCheckRun,
  SpotCheckRunsQuery,
  SpotChecksQuery,
  SubmitSpotCheckPhotoRequest,
  UpdateAreaRequest,
  UpdateSpotCheckRequest,
} from './types';

import { loginRequest, logoutRequest } from './auth-api';
import { ApiError, request as call, requestAll, USE_REAL_API } from './http';

/**
 * The platform records the first mark as a change too (`UNMARKED` to a status).
 * It is not a correction: the row would show "Not marked → Present" and lose its
 * "who and when" line. Keep only real corrections, as the mock does.
 */
function withoutFirstMark(mark: AttendanceMark): AttendanceMark {
  return {
    ...mark,
    changes: mark.changes.filter((change) => change.from_status !== 'UNMARKED'),
  };
}

export { ApiError };

/**
 * With `EXPO_PUBLIC_API_BASE_URL` set, calls go to the platform; left empty, the
 * app runs on the fixture mock. Runs, answers and photograph uploads have no
 * endpoints on the platform yet (Lamax, weeks 6 to 8): Home is empty and the rest
 * fail until they land.
 */
export class NotBuiltError extends Error {}

/**
 * Whether the platform can list the movements of a whole outlet. API Contract §12
 * has the ledger per item only, so against the real platform the log is per item.
 */
export const OUTLET_MOVEMENT_LOG = !USE_REAL_API;

function notBuilt(endpoint: string): Promise<never> {
  return Promise.reject(
    new NotBuiltError(`${endpoint} is not on the platform yet. Use the mock.`),
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
  staff: {
    /** GET /staff?outlet_id=&search=&include_archived= */
    list(query: StaffQuery): Promise<Page<Staff>> {
      return USE_REAL_API
        ? call<Page<Staff>>('/staff', {
            query: {
              outlet_id: query.outletId,
              search: query.search,
              include_archived: query.includeArchived,
              page: query.page,
              page_size: query.pageSize,
            },
          })
        : mockListStaff(query);
    },

    /** POST /staff */
    create(request: CreateStaffRequest): Promise<Staff> {
      return USE_REAL_API
        ? call<Staff>('/staff', { method: 'POST', body: request })
        : mockCreateStaff(request);
    },

    /** PATCH /staff/{id} — name, code, archive. */
    update(id: number, request: UpdateStaffRequest): Promise<Staff> {
      return USE_REAL_API
        ? call<Staff>(`/staff/${id}`, { method: 'PATCH', body: request })
        : mockUpdateStaff(id, request);
    },

    /** POST /staff/{id}/outlets — enrol, or set whether they are active there. */
    enrol(id: number, request: EnrolStaffRequest): Promise<Staff> {
      return USE_REAL_API
        ? call<Staff>(`/staff/${id}/outlets`, { method: 'POST', body: request })
        : mockEnrolStaff(id, request);
    },
  },
  attendance: {
    /** GET /attendance/configs?outlet_id=&include_archived= */
    configs(query: AttendanceConfigsQuery): Promise<Page<AttendanceConfig>> {
      return USE_REAL_API
        ? call<Page<AttendanceConfig>>('/attendance/configs', {
            query: {
              outlet_id: query.outletId,
              include_archived: query.includeArchived,
              page: query.page,
              page_size: query.pageSize,
            },
          })
        : mockListAttendanceConfigs(query);
    },

    /** POST /attendance/configs */
    createConfig(
      request: CreateAttendanceConfigRequest,
    ): Promise<AttendanceConfig> {
      return USE_REAL_API
        ? call<AttendanceConfig>('/attendance/configs', {
            method: 'POST',
            body: request,
          })
        : mockCreateAttendanceConfig(request);
    },

    /** PATCH /attendance/configs/{id} */
    updateConfig(
      id: number,
      request: UpdateAttendanceConfigRequest,
    ): Promise<AttendanceConfig> {
      return USE_REAL_API
        ? call<AttendanceConfig>(`/attendance/configs/${id}`, {
            method: 'PATCH',
            body: request,
          })
        : mockUpdateAttendanceConfig(id, request);
    },

    /** POST /attendance/configs/{id}/archive */
    archiveConfig(id: number): Promise<AttendanceConfig> {
      return USE_REAL_API
        ? call<AttendanceConfig>(`/attendance/configs/${id}/archive`, {
            method: 'POST',
          })
        : mockArchiveAttendanceConfig(id);
    },

    /** POST /attendance/configs/{id}/managers */
    appointManager(
      id: number,
      request: AppointManagerRequest,
    ): Promise<AttendanceConfig> {
      return USE_REAL_API
        ? call<AttendanceConfig>(`/attendance/configs/${id}/managers`, {
            method: 'POST',
            body: request,
          })
        : mockAppointAttendanceManager(id, request);
    },

    /** DELETE /attendance/configs/{id}/managers/{user_id} */
    removeManager(id: number, userId: number): Promise<void> {
      return USE_REAL_API
        ? call<void>(`/attendance/configs/${id}/managers/${userId}`, {
            method: 'DELETE',
          })
        : mockRemoveAttendanceManager(id, userId);
    },

    /** GET /attendance/sessions?outlet_id=&state=&from=&to= */
    sessions(query: AttendanceSessionsQuery): Promise<Page<AttendanceSession>> {
      return USE_REAL_API
        ? call<Page<AttendanceSession>>('/attendance/sessions', {
            query: {
              outlet_id: query.outletId,
              state: query.state,
              from: query.from,
              to: query.to,
              page: query.page,
              page_size: query.pageSize,
            },
          })
        : mockListAttendanceSessions(query);
    },

    /** GET /attendance/sessions/{id} — with the roster snapshot. */
    session(id: number): Promise<AttendanceSessionDetail> {
      return USE_REAL_API
        ? call<AttendanceSessionDetail>(`/attendance/sessions/${id}`).then(
            (detail) => ({
              ...detail,
              marks: detail.marks.map(withoutFirstMark),
            }),
          )
        : mockGetAttendanceSession(id);
    },

    /** PATCH /attendance/marks/{id} */
    mark(id: number, request: MarkPersonRequest): Promise<AttendanceMark> {
      return USE_REAL_API
        ? call<AttendanceMark>(`/attendance/marks/${id}`, {
            method: 'PATCH',
            body: request,
          }).then(withoutFirstMark)
        : mockMarkPerson(id, request);
    },
  },
  inventory: {
    /** GET /inventory/items?outlet_id=&search=&include_archived= */
    items(query: InventoryItemsQuery): Promise<Page<InventoryItem>> {
      return USE_REAL_API
        ? call<Page<InventoryItem>>('/inventory/items', {
            query: {
              outlet_id: query.outletId,
              search: query.search,
              include_archived: query.includeArchived,
              page: query.page,
              page_size: query.pageSize,
            },
          })
        : mockListInventoryItems(query);
    },

    /** POST /inventory/items */
    createItem(request: CreateInventoryItemRequest): Promise<InventoryItem> {
      return USE_REAL_API
        ? call<InventoryItem>('/inventory/items', {
            method: 'POST',
            body: request,
          })
        : mockCreateInventoryItem(request);
    },

    /** PATCH /inventory/items/{id} */
    updateItem(
      id: number,
      request: UpdateInventoryItemRequest,
    ): Promise<InventoryItem> {
      return USE_REAL_API
        ? call<InventoryItem>(`/inventory/items/${id}`, {
            method: 'PATCH',
            body: request,
          })
        : mockUpdateInventoryItem(id, request);
    },

    /**
     * GET /inventory/items/{id}/movements. The outlet-wide log (no `itemId`) has
     * no endpoint in the contract yet, so against the platform it is not built.
     */
    movements(
      query: InventoryMovementsQuery,
    ): Promise<Page<InventoryMovement>> {
      if (!USE_REAL_API) return mockListInventoryMovements(query);
      if (query.itemId === undefined) {
        return notBuilt('GET /inventory/movements');
      }
      return call<Page<InventoryMovement>>(
        `/inventory/items/${query.itemId}/movements`,
        {
          query: {
            from: query.from,
            to: query.to,
            page: query.page,
            page_size: query.pageSize,
          },
        },
      );
    },

    /** POST /inventory/items/{id}/movements — append-only. */
    record(
      itemId: number,
      request: RecordMovementRequest,
    ): Promise<InventoryMovement> {
      return USE_REAL_API
        ? call<InventoryMovement>(`/inventory/items/${itemId}/movements`, {
            method: 'POST',
            body: request,
          })
        : mockRecordInventoryMovement(itemId, request);
    },

    /** Inventory Managers of an outlet. No endpoint yet (Known Inconsistency #7). */
    managers(outletId: number): Promise<InventoryManager[]> {
      return USE_REAL_API
        ? notBuilt('GET /inventory/managers')
        : mockListInventoryManagers(outletId);
    },

    /** Appoint an Inventory Manager. No endpoint yet. */
    appointManager(outletId: number, userId: number): Promise<void> {
      return USE_REAL_API
        ? notBuilt('POST /inventory/managers')
        : mockAppointInventoryManager(outletId, userId);
    },

    /** Remove an Inventory Manager. No endpoint yet. */
    removeManager(outletId: number, userId: number): Promise<void> {
      return USE_REAL_API
        ? notBuilt('DELETE /inventory/managers')
        : mockRemoveInventoryManager(outletId, userId);
    },

    /** GET /inventory/reports/stock-on-hand?outlet_id= */
    stockOnHand(
      query: Pick<StockReportQuery, 'outletId'>,
    ): Promise<StockOnHandReport> {
      return USE_REAL_API
        ? call<StockOnHandReport>('/inventory/reports/stock-on-hand', {
            query: { outlet_id: query.outletId },
          })
        : mockStockOnHandReport(query);
    },

    /** GET /inventory/reports/summary?outlet_id=&from=&to= */
    summary(query: StockReportQuery): Promise<StockSummaryReport> {
      return USE_REAL_API
        ? call<StockSummaryReport>('/inventory/reports/summary', {
            query: {
              outlet_id: query.outletId,
              from: query.from,
              to: query.to,
            },
          })
        : mockStockSummaryReport(query);
    },

    /** GET /inventory/reports/spend?outlet_id=&from=&to= */
    spend(query: StockReportQuery): Promise<StockSpendReport> {
      return USE_REAL_API
        ? call<StockSpendReport>('/inventory/reports/spend', {
            query: {
              outlet_id: query.outletId,
              from: query.from,
              to: query.to,
            },
          })
        : mockStockSpendReport(query);
    },
  },
  spotChecks: {
    /** Areas of an outlet. Mock only: API Contract §13 has no endpoint for them. */
    areas(query: AreasQuery): Promise<Page<Area>> {
      return USE_REAL_API ? notBuilt('GET /areas') : mockListAreas(query);
    },

    createArea(request: CreateAreaRequest): Promise<Area> {
      return USE_REAL_API ? notBuilt('POST /areas') : mockCreateArea(request);
    },

    updateArea(id: number, request: UpdateAreaRequest): Promise<Area> {
      return USE_REAL_API
        ? notBuilt('PATCH /areas/{id}')
        : mockUpdateArea(id, request);
    },

    /** GET /spot-checks?outlet_id= */
    checks(query: SpotChecksQuery): Promise<Page<SpotCheck>> {
      return USE_REAL_API
        ? notBuilt('GET /spot-checks')
        : mockListSpotChecks(query);
    },

    /** One check with its prompts and items. */
    check(id: number): Promise<SpotCheck> {
      return USE_REAL_API
        ? notBuilt('GET /spot-checks/{id}')
        : mockGetSpotCheck(id);
    },

    /** POST /spot-checks */
    createCheck(request: CreateSpotCheckRequest): Promise<SpotCheck> {
      return USE_REAL_API
        ? notBuilt('POST /spot-checks')
        : mockCreateSpotCheck(request);
    },

    /** PATCH /spot-checks/{id} */
    updateCheck(
      id: number,
      request: UpdateSpotCheckRequest,
    ): Promise<SpotCheck> {
      return USE_REAL_API
        ? notBuilt('PATCH /spot-checks/{id}')
        : mockUpdateSpotCheck(id, request);
    },

    /** POST /spot-checks/{id}/captures */
    addCapture(
      id: number,
      request: SpotCheckCaptureRequest,
    ): Promise<SpotCheckCapture> {
      return USE_REAL_API
        ? notBuilt('POST /spot-checks/{id}/captures')
        : mockAddSpotCheckCapture(id, request);
    },

    /** Edit a prompt. Mock only. */
    updateCapture(
      id: number,
      position: number,
      request: SpotCheckCaptureRequest,
    ): Promise<SpotCheckCapture> {
      return USE_REAL_API
        ? notBuilt('PATCH /spot-checks/{id}/captures/{position}')
        : mockUpdateSpotCheckCapture(id, position, request);
    },

    /** Remove a prompt. Mock only. */
    removeCapture(id: number, position: number): Promise<void> {
      return USE_REAL_API
        ? notBuilt('DELETE /spot-checks/{id}/captures/{position}')
        : mockRemoveSpotCheckCapture(id, position);
    },

    /** POST /spot-checks/{id}/assertions */
    addAssertion(
      id: number,
      request: SpotCheckAssertionRequest,
    ): Promise<SpotCheckAssertion> {
      return USE_REAL_API
        ? notBuilt('POST /spot-checks/{id}/assertions')
        : mockAddSpotCheckAssertion(id, request);
    },

    /** Edit or archive an item. Mock only. */
    updateAssertion(
      id: number,
      position: number,
      request: SpotCheckAssertionRequest,
    ): Promise<SpotCheckAssertion> {
      return USE_REAL_API
        ? notBuilt('PATCH /spot-checks/{id}/assertions/{position}')
        : mockUpdateSpotCheckAssertion(id, position, request);
    },

    /** Spot-check Managers of an outlet. No endpoint yet (Known Inconsistency #7). */
    managers(outletId: number): Promise<SpotCheckManager[]> {
      return USE_REAL_API
        ? notBuilt('GET /spot-checks/managers')
        : mockListSpotCheckManagers(outletId);
    },

    appointManager(outletId: number, userId: number): Promise<void> {
      return USE_REAL_API
        ? notBuilt('POST /spot-checks/managers')
        : mockAppointSpotCheckManager(outletId, userId);
    },

    removeManager(outletId: number, userId: number): Promise<void> {
      return USE_REAL_API
        ? notBuilt('DELETE /spot-checks/managers')
        : mockRemoveSpotCheckManager(outletId, userId);
    },

    /** GET /spot-check-runs?state=&outlet_id= */
    runs(query: SpotCheckRunsQuery): Promise<Page<SpotCheckRun>> {
      return USE_REAL_API
        ? notBuilt('GET /spot-check-runs')
        : mockListSpotCheckRuns(query);
    },

    /** GET /spot-check-runs/{id} */
    run(id: number): Promise<SpotCheckRun> {
      return USE_REAL_API
        ? notBuilt('GET /spot-check-runs/{id}')
        : mockGetSpotCheckRun(id);
    },

    /** POST /spot-check-runs/{id}/photos — 409 `window_closed` after the close. */
    submitPhoto(
      id: number,
      request: SubmitSpotCheckPhotoRequest,
    ): Promise<SpotCheckRun> {
      return USE_REAL_API
        ? notBuilt('POST /spot-check-runs/{id}/photos')
        : mockSubmitSpotCheckPhoto(id, request);
    },

    /** PATCH /spot-check-results/{id} — the note is required. */
    overrideResult(
      id: number,
      request: OverrideSpotCheckResultRequest,
    ): Promise<SpotCheckResult> {
      return USE_REAL_API
        ? notBuilt('PATCH /spot-check-results/{id}')
        : mockOverrideSpotCheckResult(id, request);
    },
  },
} as const;
