/**
 * The mock backend: JSON fixtures matching the API Contract's shapes.
 *
 * Everything here is ZamZam's: one business, four outlets that run the two owner's
 * cash checklists (Opening cash balance, Closing cash balance), and its people.
 *
 * Who sees what on Home and the tab bar:
 *   priya  (OWNER)  — counts the cash: answers all eight runs → Home has Open now and Upcoming
 *   nadia  (MEMBER) — Checklist Manager of all eight         → Home has Overseeing and Upcoming
 *   raheem (ADMIN), zoya — no assignments → empty Home; they author and assign
 *   suresh — inventory manager               → Modules (Inventory)
 *   meera  — attendance manager              → Modules (Attendance)
 *   kiran, sana, ananthu, sreelakshmi.un — on no checklist → "your manager will add you"
 *   anil   — deactivated, still on a team    → shows as Inactive
 *
 * Credentials:
 *   every ZamZam person (priya, raheem, nadia, …) — password "1234"
 *   any persona + password "wrong"      — invalid_credentials
 *   busy / anything                     — rate_limited
 *   offline / anything                  — unreachable (no response)
 *   network-error / anything            — 500
 *   The sign-in business picker needs the same username in two businesses; with one
 *   business the mock can no longer show it.
 */
import { onlineManager } from '@tanstack/react-query';
import type {
  Area,
  AreasQuery,
  CreateAreaRequest,
  CreateSpotCheckRequest,
  OverrideSpotCheckResultRequest,
  SpotCheck,
  SpotCheckAssertion,
  SpotCheckAssertionRequest,
  SpotCheckLists,
  SpotCheckCapture,
  SpotCheckCaptureRequest,
  SpotCheckCompletion,
  SpotCheckManager,
  SpotCheckOutcome,
  SpotCheckPhoto,
  SpotCheckRecurrence,
  SpotCheckResult,
  SpotCheckRun,
  SpotCheckRunsQuery,
  SpotCheckRunStatus,
  SpotChecksQuery,
  SpotCheckSubjectType,
  SubmitSpotCheckPhotoRequest,
  UpdateAreaRequest,
  UpdateSpotCheckRequest,
  AddMemberRequest,
  AmbiguousUsernameBody,
  AnswerTaskRequest,
  ApiErrorBody,
  AppointManagerRequest,
  AttendanceConfig,
  AttendanceConfigsQuery,
  AttendanceCounts,
  AttendanceMark,
  AttendanceMarkChange,
  AttendanceMarkStatus,
  AttendanceSession,
  AttendanceSessionDetail,
  AttendanceSessionsQuery,
  CreateAttendanceConfigRequest,
  CreateInventoryItemRequest,
  CreateStaffRequest,
  EnrolStaffRequest,
  InventoryItem,
  InventoryItemsQuery,
  InventoryManager,
  InventoryMovement,
  InventoryMovementKind,
  InventoryMovementsQuery,
  InventoryUnit,
  MarkPersonRequest,
  RecordMovementRequest,
  Staff,
  StaffQuery,
  StockOnHandReport,
  StockReportQuery,
  StockSpendReport,
  StockSummaryReport,
  UpdateAttendanceConfigRequest,
  UpdateInventoryItemRequest,
  UpdateStaffRequest,
  Candidate,
  CandidatesQuery,
  Checklist,
  ChecklistDetail,
  CreateAssignmentsRequest,
  CreateChecklistRequest,
  CreateTaskRequest,
  LoginRequest,
  LoginResponse,
  CreateOutletRequest,
  CreateUserRequest,
  RemovedTeamPerson,
  Team,
  TeamPerson,
  ChecklistListItem,
  OutletAssignment,
  ReorderTasksRequest,
  MeResponse,
  Outlet,
  Page,
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
} from '@/shared/api/types';
import { API_ERROR_CODE } from '@/shared/api/types';
import { canAdminister, type Role } from '@/shared/constants/roles';
import { DEFAULT_WEIGHT } from '@/shared/constants/weight';
import {
  HOURLY_INTERVALS,
  MIN_WINDOW_MINUTES,
  isRunTime,
  windowOverlapsNextRun,
} from '@/shared/lib/schedule';
import { ApiError } from '@/shared/api/http';
import { effectiveOutcome } from '@/shared/lib/spot-outcome';

import attendanceFixtures from './fixtures/attendance.json';
import businesses from './fixtures/businesses.json';
import checklistFixtures from './fixtures/checklists.json';
import inventoryFixtures from './fixtures/inventory.json';
import outletFixtures from './fixtures/outlets.json';
import spotCheckFixtures from './fixtures/spot-checks.json';
import users from './fixtures/users.json';

type DbOutlet = Outlet & { tenant_id: number };

type DbUser = {
  id: number;
  tenant_id: number;
  username: string;
  password: string;
  full_name: string;
  tenant_role: Role;
  interface_language: 'EN' | 'HI' | 'ML' | 'KN';
  memberships: MeResponse['memberships'];
  is_active: boolean;
};

/** Long enough to see the loading state, short enough not to feel broken. */
const NETWORK_DELAY_MS = 700;

type Session = { userId: number; token: string };

type MockDb = {
  users: DbUser[];
  businesses: typeof businesses;
  outlets: DbOutlet[];
  session: Session | null;
  /** When this mock session began — the fixed point today's runs hang off. */
  startedAt: number;
  /** Answered task id → the write that landed on it (answers survive refetches). */
  answers: Map<number, AnswerTaskRequest>;
  /** Upload keys per run task, so an answer's `image_url` can resolve. */
  signedUploadKeys: Map<number, string>;
  /** Image task id → the stand-in AI verdict and when it becomes visible. */
  judgements?: Map<number, { readyAt: number; verdict: 'PASS' | 'FAIL' }>;
  /** Authored checklists, tasks and assignments; seeded on first use. */
  checklistState?: ChecklistState;
  /** Staff, attendance configurations, sessions and marks; seeded on first use. */
  attendanceState?: AttendanceState;
  /** Inventory items and their append-only movements; seeded on first use. */
  inventoryState?: InventoryState;
  /** Areas, spot checks, their runs and results; seeded on first use. */
  spotCheckState?: SpotCheckState;
};

const STAFF_FIRST_NAMES = [
  'Aarav',
  'Bina',
  'Chetan',
  'Divya',
  'Eshan',
  'Farah',
  'Gopal',
  'Hema',
  'Imran',
  'Jaya',
];
const STAFF_LAST_NAMES = [
  'Menon',
  'Pillai',
  'Rao',
  'Shetty',
  'Nambiar',
  'Kurup',
  'Das',
  'Iyer',
  'Bhat',
  'Khan',
  'Thomas',
  'George',
  'Varma',
];

/**
 * 130 more team members for ZamZam, so a list of people runs past one page and
 * the picker's scrolling and server-side search have something to work on.
 */
function extraStaff(): DbUser[] {
  const tenantId = 7;
  return STAFF_FIRST_NAMES.flatMap((first, f) =>
    STAFF_LAST_NAMES.map((last, l) => {
      const index = f * STAFF_LAST_NAMES.length + l;
      return {
        id: 1000 + index,
        tenant_id: tenantId,
        username: `${first}.${last}`.toLowerCase(),
        password: '1234',
        full_name: `${first} ${last}`,
        tenant_role: 'MEMBER' as const,
        interface_language: 'EN' as const,
        memberships: {
          cl_admin_assignments: [],
          cl_imp_assignments: [],
          attendance_configs: [],
          inventory_outlets: [],
          spot_check_outlets: [],
        },
        // A few have left, so "Inactive" rows show up in the picker too.
        is_active: index % 17 !== 0,
      };
    }),
  );
}

/**
 * Kept on `globalThis` so a hot reload of this file does not wipe the session
 * and every edit made so far, which would make each call answer token_expired
 * while the screens still show a cached identity.
 */
const store = globalThis as typeof globalThis & { __miseMockDb?: MockDb };
const db: MockDb = (store.__miseMockDb ??= {
  answers: new Map(),
  signedUploadKeys: new Map(),
  users: [...(users as DbUser[]), ...extraStaff()],
  businesses,
  outlets: outletFixtures.map((outlet) => ({ ...outlet })),
  session: null,
  startedAt: Date.now(),
});

/** Single choke point for simulated latency — randomised per AGENTS.md. */
function delay(): Promise<void> {
  const jitter = NETWORK_DELAY_MS * (0.75 + Math.random() * 0.5);
  return new Promise((resolvePromise) => setTimeout(resolvePromise, jitter));
}

type LoginOutcome =
  | { status: 200; body: LoginResponse }
  | { status: 409; body: AmbiguousUsernameBody }
  | { status: 401; body: ApiErrorBody }
  | { status: 429; body: ApiErrorBody }
  | { status: 500; body: ApiErrorBody };

function resolveLogin(request: LoginRequest): LoginOutcome {
  const username = request.username.trim().toLowerCase();

  if (username === 'offline') {
    throw new Error('Network request failed');
  }
  if (username === 'busy') {
    return {
      status: 429,
      body: {
        error: {
          code: 'rate_limited',
          message: 'Too many attempts.',
          field: null,
        },
      },
    };
  }
  if (username === 'network-error') {
    return {
      status: 500,
      body: {
        error: { code: 'server_error', message: 'Server fault.', field: null },
      },
    };
  }

  const matches = db.users.filter((user) => user.username === username);

  if (matches.length > 1 && request.tenant_id === undefined) {
    return {
      status: 409,
      body: {
        error: {
          code: API_ERROR_CODE.AMBIGUOUS_USERNAME,
          message: 'Pick a business.',
          field: null,
          businesses: matches.map((user) => {
            const business = db.businesses.find((b) => b.id === user.tenant_id);
            return { id: business?.id ?? 0, name: business?.name ?? '' };
          }),
        },
      },
    };
  }

  const user =
    request.tenant_id !== undefined
      ? matches.find((candidate) => candidate.tenant_id === request.tenant_id)
      : matches[0];

  if (!user || !user.is_active || user.password !== request.password) {
    return {
      status: 401,
      body: {
        error: {
          code: API_ERROR_CODE.INVALID_CREDENTIALS,
          message: 'No match.',
          field: null,
        },
      },
    };
  }

  db.session = { userId: user.id, token: `mock-access-${user.id}` };
  return {
    status: 200,
    body: { access: db.session.token, refresh: `mock-refresh-${user.id}` },
  };
}

/** Outlets of a business with a module switched on; archived ones drop out. */
function liveOutlets(
  tenantId: number,
  flag: 'attendance_enabled' | 'spot_checks_enabled',
): number[] {
  return db.outlets
    .filter(
      (outlet) =>
        outlet.tenant_id === tenantId && outlet[flag] && !outlet.is_archived,
    )
    .map((outlet) => outlet.id);
}

function resolveMe(): MeResponse {
  if (!db.session) {
    throw new ApiError(401, {
      error: {
        code: API_ERROR_CODE.TOKEN_EXPIRED,
        message: 'Not signed in.',
        field: null,
      },
    });
  }
  const user = db.users.find(
    (candidate) => candidate.id === db.session!.userId,
  )!;
  const business = db.businesses.find(
    (candidate) => candidate.id === user.tenant_id,
  )!;
  return {
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      tenant_role: user.tenant_role,
      interface_language: user.interface_language,
    },
    business: { id: business.id, name: business.name },
    modules: {
      ...business.modules,
      attendance_outlets: liveOutlets(business.id, 'attendance_enabled'),
      spot_check_outlets: liveOutlets(business.id, 'spot_checks_enabled'),
    },
    memberships: user.memberships,
  };
}

/** POST /auth/login */
export async function mockLogin(request: LoginRequest): Promise<LoginResponse> {
  await delay();
  const outcome = resolveLogin(request);
  if (outcome.status !== 200) throw new ApiError(outcome.status, outcome.body);
  return outcome.body;
}

/** GET /auth/me */
export async function mockFetchMe(): Promise<MeResponse> {
  await delay();
  return resolveMe();
}

/** PATCH /auth/me — the one self-service edit: interface_language. */
export async function mockUpdateMe(
  request: UpdateMeRequest,
): Promise<MeResponse> {
  await delay();
  const me = resolveMe();
  const user = db.users.find((candidate) => candidate.id === me.user.id)!;
  user.interface_language = request.interface_language;
  return resolveMe();
}

/** POST /auth/logout */
export async function mockLogout(): Promise<void> {
  await delay();
  db.session = null;
}

function apiError(
  status: number,
  code: string,
  message: string,
  field?: string,
) {
  return new ApiError(status, {
    error: { code, message, field: field ?? null },
  });
}

/** The signed-in ADMIN or OWNER; anyone else is refused, as the platform does. */
function requireAdmin() {
  const me = resolveMe();
  if (!canAdminister(me.user.tenant_role)) {
    throw apiError(403, 'authoring_forbidden', 'Not permitted.');
  }
  return me;
}

function toOutlet({ tenant_id: _tenant, ...outlet }: DbOutlet): Outlet {
  return outlet;
}

function findOutlet(tenantId: number, id: number): DbOutlet {
  const outlet = db.outlets.find(
    (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
  );
  if (!outlet) throw apiError(404, 'not_found', 'Not found.');
  return outlet;
}

/** `unique(tenant_id, name)` — case-insensitive here, as a person would read it. */
function assertNameFree(tenantId: number, name: string, exceptId?: number) {
  const taken = db.outlets.some(
    (outlet) =>
      outlet.tenant_id === tenantId &&
      outlet.id !== exceptId &&
      outlet.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    throw apiError(
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
      'An outlet with this name already exists.',
      'name',
    );
  }
}

/** A name of "offline" stands in for the network dying mid-save. */
function assertReachable(name?: string) {
  if (name?.trim().toLowerCase() === 'offline') {
    throw new Error('Network request failed');
  }
}

/** GET /outlets?include_archived=true */
export async function mockListOutlets(): Promise<Outlet[]> {
  await delay();
  const me = resolveMe();
  return db.outlets
    .filter((outlet) => outlet.tenant_id === me.business.id)
    .map(toOutlet);
}

/** GET /outlets/{id} */
export async function mockGetOutlet(id: number): Promise<Outlet> {
  await delay();
  const me = resolveMe();
  return toOutlet(findOutlet(me.business.id, id));
}

/** POST /outlets */
export async function mockCreateOutlet(
  request: CreateOutletRequest,
): Promise<Outlet> {
  await delay();
  const me = requireAdmin();
  const name = request.name.trim();
  assertReachable(name);
  assertNameFree(me.business.id, name);
  const outlet: DbOutlet = {
    id: Math.max(0, ...db.outlets.map((candidate) => candidate.id)) + 1,
    tenant_id: me.business.id,
    name,
    attendance_enabled: false,
    spot_checks_enabled: false,
    is_archived: false,
  };
  db.outlets.push(outlet);
  return toOutlet(outlet);
}

/** PATCH /outlets/{id} */
export async function mockUpdateOutlet(
  id: number,
  request: UpdateOutletRequest,
): Promise<Outlet> {
  await delay();
  const me = requireAdmin();
  const outlet = findOutlet(me.business.id, id);
  if (outlet.is_archived) {
    throw apiError(409, 'archived', "Can't be edited while archived.");
  }
  if (request.name !== undefined) {
    const name = request.name.trim();
    assertReachable(name);
    assertNameFree(me.business.id, name, id);
    outlet.name = name;
  }
  if (request.attendance_enabled !== undefined) {
    outlet.attendance_enabled = request.attendance_enabled;
  }
  if (request.spot_checks_enabled !== undefined) {
    outlet.spot_checks_enabled = request.spot_checks_enabled;
  }
  return toOutlet(outlet);
}

/** POST /outlets/{id}/archive — there is no delete endpoint. */
export async function mockArchiveOutlet(id: number): Promise<Outlet> {
  await delay();
  const me = requireAdmin();
  const outlet = findOutlet(me.business.id, id);
  outlet.is_archived = true;
  return toOutlet(outlet);
}

const ROLE_RANK: Record<Role, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

function toUser(user: DbUser): User {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    tenant_role: user.tenant_role,
    is_active: user.is_active,
  };
}

function findUser(tenantId: number, id: number): DbUser {
  const user = db.users.find(
    (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
  );
  if (!user) throw apiError(404, 'not_found', 'Not found.');
  return user;
}

/** Who may act on whom: nobody on themselves, the Owner, or (for an Admin) a peer Admin. */
function actorRelation(
  viewer: { id: number; tenant_role: Role },
  target: DbUser,
) {
  const self = target.id === viewer.id;
  const ownerTarget = target.tenant_role === 'OWNER';
  const peerAdmin =
    viewer.tenant_role === 'ADMIN' && target.tenant_role === 'ADMIN' && !self;
  return { self, ownerTarget, peerAdmin };
}

/** GET /users — filtered, searched and paginated. */
export async function mockListUsers(query: UsersQuery): Promise<Page<User>> {
  await delay();
  const me = requireAdmin();
  const needle = query.search?.trim().toLowerCase();
  const matches = db.users
    .filter((user) => user.tenant_id === me.business.id)
    .filter(
      (user) => query.role === undefined || user.tenant_role === query.role,
    )
    .filter(
      (user) =>
        query.isActive === undefined || user.is_active === query.isActive,
    )
    .filter(
      (user) =>
        !needle ||
        user.full_name.toLowerCase().includes(needle) ||
        user.username.toLowerCase().includes(needle),
    )
    .sort(
      (a, b) =>
        ROLE_RANK[a.tenant_role] - ROLE_RANK[b.tenant_role] ||
        a.full_name.localeCompare(b.full_name) ||
        a.id - b.id,
    );
  // Like the platform: a page size above 100 is cut to 100, and a page past the
  // end is a 404 (page 1 of an empty result is fine).
  const pageSize = Math.min(Math.max(query.pageSize, 1), 100);
  const start = (query.page - 1) * pageSize;
  if (query.page > 1 && start >= matches.length) {
    throw apiError(404, 'not_found', 'Not found.');
  }
  return {
    count: matches.length,
    next: start + pageSize < matches.length ? query.page + 1 : null,
    previous: query.page > 1 ? query.page - 1 : null,
    results: matches.slice(start, start + pageSize).map(toUser),
  };
}

/** GET /users/{id} */
export async function mockGetUser(id: number): Promise<User> {
  await delay();
  const me = requireAdmin();
  return toUser(findUser(me.business.id, id));
}

/** POST /users */
export async function mockCreateUser(
  request: CreateUserRequest,
): Promise<User> {
  await delay();
  const me = requireAdmin();
  const username = request.username.trim().toLowerCase();
  if (username === 'offline') throw new Error('Network request failed');
  if (request.tenant_role === 'OWNER') {
    throw apiError(409, 'owner_exists', 'There is already an Owner.');
  }
  if (request.tenant_role === 'ADMIN' && me.user.tenant_role !== 'OWNER') {
    throw apiError(403, 'authoring_forbidden', 'Not permitted.');
  }
  const taken = db.users.some(
    (user) => user.tenant_id === me.business.id && user.username === username,
  );
  if (taken) {
    throw apiError(
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
      'This username is already used.',
      'username',
    );
  }
  const user: DbUser = {
    id: Math.max(0, ...db.users.map((candidate) => candidate.id)) + 1,
    tenant_id: me.business.id,
    username,
    password: request.password,
    full_name: request.full_name.trim(),
    tenant_role: request.tenant_role,
    interface_language: 'EN',
    memberships: {
      cl_admin_assignments: [],
      cl_imp_assignments: [],
      attendance_configs: [],
      inventory_outlets: [],
      spot_check_outlets: [],
    },
    is_active: true,
  };
  db.users.push(user);
  return toUser(user);
}

/** PATCH /users/{id} */
export async function mockUpdateUser(
  id: number,
  request: UpdateUserRequest,
): Promise<User> {
  await delay();
  const me = requireAdmin();
  const user = findUser(me.business.id, id);
  const { self, ownerTarget, peerAdmin } = actorRelation(me.user, user);
  const forbidden = self || ownerTarget || peerAdmin;

  if (
    request.tenant_role !== undefined &&
    request.tenant_role !== user.tenant_role
  ) {
    if (forbidden) throw apiError(403, 'authoring_forbidden', 'Not permitted.');
    if (request.tenant_role === 'OWNER') {
      throw apiError(409, 'owner_exists', 'There is already an Owner.');
    }
    if (request.tenant_role === 'ADMIN' && me.user.tenant_role !== 'OWNER') {
      throw apiError(403, 'authoring_forbidden', 'Not permitted.');
    }
  }
  if (request.is_active !== undefined && request.is_active !== user.is_active) {
    if (forbidden) throw apiError(403, 'authoring_forbidden', 'Not permitted.');
  }

  if (request.full_name !== undefined)
    user.full_name = request.full_name.trim();
  if (request.tenant_role !== undefined) user.tenant_role = request.tenant_role;
  if (request.is_active !== undefined) user.is_active = request.is_active;
  return toUser(user);
}

/** POST /users/{id}/reset-password */
export async function mockResetPassword(
  id: number,
  request: ResetPasswordRequest,
): Promise<void> {
  await delay();
  const me = requireAdmin();
  const user = findUser(me.business.id, id);
  const { ownerTarget, peerAdmin } = actorRelation(me.user, user);
  if (
    !user.is_active ||
    peerAdmin ||
    (ownerTarget && me.user.tenant_role !== 'OWNER')
  ) {
    throw apiError(403, 'authoring_forbidden', 'Not permitted.');
  }
  user.password = request.password;
}

type RunTemplate = {
  assignmentId: number;
  checklist: string;
  outlet: string;
  /** Minutes after local midnight. */
  open: number;
  close: number;
  /** Today's window as minutes from now, so the run is open whenever the app is demoed. */
  todayFromNow?: { open: number; close: number };
  total: number;
  answered: number;
};

/** The four ZamZam outlets that run the two cash checklists, with their assignment ids. */
const CASH_OUTLETS = [
  { name: 'ZamZam', opening: 11, closing: 21 },
  { name: 'Elegance', opening: 12, closing: 22 },
  { name: 'Icefruits', opening: 13, closing: 23 },
  { name: 'ZamZam Grande', opening: 14, closing: 24 },
] as const;

/**
 * Opening cash balance is open when the app is demoed (so Home has something to do
 * now); closing cash balance opens a few hours later (so Home has something coming).
 * How far through each outlet's opening count is differs, to show every progress.
 */
const OPENING_PROGRESS = [2, 0, 4, 1];
const RUN_TEMPLATES: RunTemplate[] = [
  ...CASH_OUTLETS.flatMap((outlet, index) => [
    {
      assignmentId: outlet.opening,
      checklist: 'Opening cash balance',
      outlet: outlet.name,
      open: 480,
      close: 660,
      todayFromNow: { open: -60 + index * 10, close: 120 + index * 20 },
      total: 4,
      answered: OPENING_PROGRESS[index],
    },
    {
      assignmentId: outlet.closing,
      checklist: 'Closing cash balance',
      outlet: outlet.name,
      open: 1320,
      close: 1440,
      todayFromNow: { open: 180 + index * 10, close: 300 + index * 10 },
      total: 5,
      answered: 0,
    },
  ]),
  {
    // Open from 12:00 am to 11:55 pm every day, for trying the photo check at any hour.
    assignmentId: 31,
    checklist: 'Test Checklist',
    outlet: 'ZamZam',
    open: 0,
    close: 1435,
    total: 3,
    answered: 0,
  },
];

/** Today's and tomorrow's runs for the caller's assignments. */
function buildRuns(
  me: MeResponse,
  { includeClosed = false }: { includeClosed?: boolean } = {},
): Run[] {
  const admin = new Set(me.memberships.cl_admin_assignments);
  const implementer = new Set(me.memberships.cl_imp_assignments);
  // Two different moments, and they must not be confused. `anchor` is fixed
  // when the app starts, so a window placed relative to it stays put and the
  // run genuinely closes. `now` is the present, which is what decides whether
  // it already has.
  const anchor = db.startedAt;
  const now = Date.now();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const runs: Run[] = [];
  for (const dayOffset of [0, 1]) {
    for (const template of RUN_TEMPLATES) {
      const role = admin.has(template.assignmentId)
        ? 'CL_ADMIN'
        : implementer.has(template.assignmentId)
          ? 'CL_IMP'
          : null;
      if (!role) continue;
      const at = (minutes: number) => {
        const day = new Date(midnight);
        day.setDate(day.getDate() + dayOffset);
        return new Date(day.getTime() + minutes * 60_000);
      };
      const rolling = dayOffset === 0 ? template.todayFromNow : undefined;
      const open = rolling
        ? new Date(anchor + rolling.open * 60_000)
        : at(template.open);
      const close = rolling
        ? new Date(anchor + rolling.close * 60_000)
        : at(template.close);
      if (!includeClosed && close.getTime() <= now) continue;
      runs.push({
        id: template.assignmentId * 100 + dayOffset,
        checklist_name: template.checklist,
        outlet_name: template.outlet,
        window_open: open.toISOString(),
        window_close: close.toISOString(),
        total_tasks: template.total,
        answered_count: dayOffset === 0 ? template.answered : 0,
        status: 'OPEN',
        my_role: role,
      });
    }
  }
  return runs;
}

/** GET /runs — today's and tomorrow's runs that have not closed, for the caller's assignments. */
export async function mockListRuns(): Promise<Run[]> {
  await delay();
  return buildRuns(resolveMe());
}

type TaskTemplate = {
  type: RunTask['answer_type'];
  text: string;
  unit?: string;
  min?: number;
  max?: number;
  /** What the answer is, for the first `answered` tasks of the run. */
  answer?: { n?: number; b?: boolean; comment?: string; by: string };
};

/** Authored task content, shown exactly as typed — never translated (Model §15). */
const OPENING_CASH_TASKS: TaskTemplate[] = [
  {
    type: 'NUMBER',
    text: 'Cash in the drawer',
    unit: '₹',
    answer: { n: 12500, by: 'priya' },
  },
  {
    type: 'NUMBER',
    text: 'Cash in the safe',
    unit: '₹',
    answer: { n: 48000, by: 'priya' },
  },
  {
    type: 'BINARY',
    text: "The opening balance matches yesterday's closing balance",
    answer: { b: true, by: 'priya' },
  },
  { type: 'IMAGE', text: 'Photograph the counted cash' },
];

const CLOSING_CASH_TASKS: TaskTemplate[] = [
  { type: 'NUMBER', text: 'Cash in the drawer', unit: '₹' },
  { type: 'NUMBER', text: 'Cash taken to the safe', unit: '₹' },
  {
    type: 'BINARY',
    text: "The closing balance matches the day's sales report",
  },
  { type: 'BINARY', text: 'The cash is locked in the safe' },
  { type: 'IMAGE', text: 'Photograph the closing cash count' },
];

/** Two photo tasks and a Yes/No, for trying the AI photo check. */
const TEST_CHECKLIST_TASKS: TaskTemplate[] = [
  { type: 'IMAGE', text: 'Photograph the counter' },
  { type: 'IMAGE', text: 'Photograph the storage shelf' },
  { type: 'BINARY', text: 'The area is clean' },
];

/** Both cash checklists have the same tasks at every outlet. */
const TASK_TEMPLATES: Record<number, TaskTemplate[]> = {
  ...Object.fromEntries(
    CASH_OUTLETS.flatMap((outlet) => [
      [outlet.opening, OPENING_CASH_TASKS],
      [outlet.closing, CLOSING_CASH_TASKS],
    ]),
  ),
  31: TEST_CHECKLIST_TASKS,
};

/** The stand-in for the AI evaluation: how long it "looks" at a photo, and the odds of a pass. */
const JUDGE_MIN_MS = 3_000;
const JUDGE_MAX_MS = 5_000;
const JUDGE_PASS_CHANCE = 0.6;

/** A photo was just submitted: pick its verdict now, show it after a short wait. */
function startJudgement(taskId: number): void {
  db.judgements ??= new Map();
  const verdict = Math.random() < JUDGE_PASS_CHANCE ? 'PASS' : 'FAIL';
  db.judgements.set(taskId, {
    readyAt:
      Date.now() + JUDGE_MIN_MS + Math.random() * (JUDGE_MAX_MS - JUDGE_MIN_MS),
    verdict,
  });
}

/** PENDING_JUDGEMENT until the wait is over, then the verdict picked at submit. */
function judgementOutcome(taskId: number): RunTask['outcome'] {
  const judgement = db.judgements?.get(taskId);
  if (!judgement) return 'PENDING_JUDGEMENT';
  return Date.now() < judgement.readyAt
    ? 'PENDING_JUDGEMENT'
    : judgement.verdict;
}

function outcomeFor(
  task: TaskTemplate,
  fallback: NonNullable<TaskTemplate['answer']> | undefined,
  written?: AnswerTaskRequest,
  taskId?: number,
): RunTask['outcome'] {
  if (task.type === 'IMAGE') {
    if (written?.image_key === undefined) return 'PASS';
    return taskId === undefined
      ? 'PENDING_JUDGEMENT'
      : judgementOutcome(taskId);
  }
  if (task.type === 'BINARY') {
    if (written?.answer_bool !== undefined) {
      return written.answer_bool ? 'PASS' : 'FAIL';
    }
    return fallback ? (fallback.b ? 'PASS' : 'FAIL') : 'PASS';
  }
  if (written?.answer_number !== undefined) {
    const n = written.answer_number;
    const low = task.min !== undefined && n < task.min;
    const high = task.max !== undefined && n > task.max;
    return low || high ? 'FAIL' : 'PASS';
  }
  if (fallback?.n !== undefined) {
    return outcomeFor(task, fallback, { answer_number: fallback.n });
  }
  return 'PASS';
}

function buildTasks(
  assignmentId: number,
  answered: number,
  opensAt: string,
): RunTask[] {
  const templates = TASK_TEMPLATES[assignmentId] ?? [];
  const open = new Date(opensAt).getTime();
  return templates.map((task, index) => {
    const id = assignmentId * 1000 + index + 1;
    const templateAnswer = index < answered ? task.answer : undefined;
    const written = db.answers.get(id);
    /** The task's own fixture answer, overlaid by anything written this session. */
    const answer: NonNullable<TaskTemplate['answer']> | undefined = written
      ? {
          by: templateAnswer?.by ?? 'kiran',
          n: written.answer_number ?? templateAnswer?.n,
          b: written.answer_bool ?? templateAnswer?.b,
          comment:
            written.comment === undefined
              ? templateAnswer?.comment
              : (written.comment ?? undefined),
        }
      : templateAnswer;
    const writtenImage =
      written?.image_key !== undefined ? written.image_key : undefined;
    const person = answer
      ? db.users.find((u) => u.username === answer.by)
      : undefined;
    return {
      id,
      position: index + 1,
      answer_type: task.type,
      text: task.text,
      unit: task.unit ?? null,
      min_value: task.min ?? null,
      max_value: task.max ?? null,
      weight: DEFAULT_WEIGHT,
      requires_comment_on_fail: task.type !== 'IMAGE',
      answer_number: answer?.n ?? null,
      answer_bool: answer && task.type === 'BINARY' ? (answer.b ?? null) : null,
      image_key:
        writtenImage !== undefined
          ? writtenImage
          : answer && task.type === 'IMAGE'
            ? `t7/mock/${assignmentId}-${index + 1}.jpg`
            : null,
      image_url: writtenImage ? `mock://storage/${writtenImage}` : null,
      comment: answer?.comment ?? null,
      outcome: written
        ? outcomeFor(task, templateAnswer, written, id)
        : templateAnswer
          ? outcomeFor(task, templateAnswer)
          : null,
      answered_by: person
        ? { id: person.id, full_name: person.full_name }
        : null,
      answered_at: answer
        ? new Date(
            written ? Date.now() : open + (index + 1) * 4 * 60_000,
          ).toISOString()
        : null,
    };
  });
}

/**
 * GET /runs/{id} — the run with its tasks. A CL_ADMIN may still read a run
 * after it closes (the final state stays); a CL_IMP never receives a closed
 * run, so it 404s for them (§7).
 */
export async function mockGetRun(id: number): Promise<RunDetail> {
  await delay();
  const me = resolveMe();
  const run = buildRuns(me, { includeClosed: true }).find((r) => r.id === id);
  const closed = run
    ? new Date(run.window_close).getTime() <= Date.now()
    : false;
  if (!run || (closed && run.my_role === 'CL_IMP')) {
    throw apiError(404, 'not_found', 'Not found.');
  }
  const assignmentId = Math.floor(run.id / 100);
  return {
    ...run,
    tasks: buildTasks(assignmentId, run.answered_count, run.window_open),
  };
}

/** Rows below carry `tenant_id` as the platform's tables do; responses drop it. */
type DbChecklist = Checklist & { tenant_id: number };
type DbTask = Task & {
  tenant_id: number;
  checklist_id: number;
  is_archived: boolean;
};
type DbAssignment = {
  id: number;
  tenant_id: number;
  checklist_id: number;
  outlet_id: number;
  outlet_name: string;
  is_active: boolean;
  /** Latest finished period's score, 0–100; null before one has closed. */
  score: number | null;
};

/**
 * Authored content, mutable for the length of a session. Who is on an
 * assignment is not stored here: it lives in each user's `memberships`, the
 * same place `/auth/me` and Home read it from, so the two cannot disagree.
 */
/** One person on one assignment, kept after they are taken off. */
type MemberLogEntry = {
  tenant_id: number;
  assignment_id: number;
  user_id: number;
  role: 'CL_ADMIN' | 'CL_IMP';
  added_at: string;
  removed_at: string | null;
  removed_by: number | null;
};

type ChecklistState = {
  checklists: DbChecklist[];
  assignments: DbAssignment[];
  tasks: DbTask[];
  nextTaskId: number;
  /**
   * Who is on each team, and who was. A user's `memberships` stay the source for
   * what they can see today (Home, /auth/me); this adds when and by whom.
   */
  memberLog: MemberLogEntry[];
};

/**
 * Seeded on first use, not at import: the task fixtures below are declared
 * after the `db` they would otherwise seed.
 */
function seedChecklistState(): ChecklistState {
  const checklists = checklistFixtures.checklists.map((checklist) => ({
    ...checklist,
  })) as DbChecklist[];
  const assignments: DbAssignment[] = checklistFixtures.assignments.map(
    (assignment) => ({
      id: assignment.id,
      tenant_id: assignment.tenant_id,
      checklist_id: assignment.checklist_id,
      outlet_id:
        db.outlets.find(
          (outlet) =>
            outlet.tenant_id === assignment.tenant_id &&
            outlet.name === assignment.outlet_name,
        )?.id ?? 0,
      outlet_name: assignment.outlet_name,
      score: assignment.score,
      is_active: true,
    }),
  );

  const tasks: DbTask[] = [];
  let nextTaskId = 1;
  const addTasks = (
    checklist: { id: number; tenant_id: number },
    templates: TaskTemplate[],
  ) => {
    templates.forEach((template, index) => {
      tasks.push({
        id: nextTaskId++,
        tenant_id: checklist.tenant_id,
        checklist_id: checklist.id,
        position: index + 1,
        answer_type: template.type,
        text: template.text,
        unit: template.unit ?? null,
        min_value: template.min ?? null,
        max_value: template.max ?? null,
        requires_comment_on_fail: template.type !== 'IMAGE',
        weight: DEFAULT_WEIGHT,
        is_archived: false,
      });
    });
  };

  // The run fixtures already author tasks per assignment; a checklist takes
  // its tasks from the first of its assignments that has some.
  const seeded = new Set<number>();
  for (const [assignmentId, templates] of Object.entries(TASK_TEMPLATES)) {
    const assignment = assignments.find((a) => a.id === Number(assignmentId));
    if (!assignment || seeded.has(assignment.checklist_id)) continue;
    seeded.add(assignment.checklist_id);
    addTasks(
      { id: assignment.checklist_id, tenant_id: assignment.tenant_id },
      templates,
    );
  }

  // Everyone already on a team was put there before this session began.
  const memberLog: MemberLogEntry[] = [];
  for (const user of db.users) {
    for (const [role, key] of [
      ['CL_ADMIN', 'cl_admin_assignments'],
      ['CL_IMP', 'cl_imp_assignments'],
    ] as const) {
      for (const assignmentId of user.memberships[key]) {
        memberLog.push({
          tenant_id: user.tenant_id,
          assignment_id: assignmentId,
          user_id: user.id,
          role,
          added_at: '2026-09-01T09:00:00.000Z',
          removed_at: null,
          removed_by: null,
        });
      }
    }
  }

  return { checklists, assignments, tasks, nextTaskId, memberLog };
}

function checklistState(): ChecklistState {
  return (db.checklistState ??= seedChecklistState());
}

function findChecklist(tenantId: number, id: number): DbChecklist {
  const checklist = checklistState().checklists.find(
    (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
  );
  if (!checklist) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return checklist;
}

/** Whether the caller is on any assignment of this checklist. */
function isOnChecklist(me: MeResponse, checklistId: number): boolean {
  const mine = new Set([
    ...me.memberships.cl_admin_assignments,
    ...me.memberships.cl_imp_assignments,
  ]);
  return checklistState().assignments.some(
    (assignment) =>
      assignment.checklist_id === checklistId && mine.has(assignment.id),
  );
}

/** A checklist the caller may read: ADMIN/OWNER any, anyone else their own. */
function findReadableChecklist(me: MeResponse, id: number): DbChecklist {
  const checklist = findChecklist(me.business.id, id);
  if (!canAdminister(me.user.tenant_role) && !isOnChecklist(me, id)) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  return checklist;
}

/** A checklist an admin may change; an archived one is read-only. */
function findEditableChecklist(me: MeResponse, id: number): DbChecklist {
  const checklist = findChecklist(me.business.id, id);
  if (checklist.is_archived) {
    throw apiError(409, 'archived', "Can't be edited while archived.");
  }
  return checklist;
}

function toChecklist({ tenant_id: _tenant, ...checklist }: DbChecklist) {
  return checklist;
}

function toTask({
  tenant_id: _tenant,
  checklist_id: _checklist,
  is_archived: _archived,
  ...task
}: DbTask): Task {
  return task;
}

function liveTasks(checklistId: number): DbTask[] {
  return checklistState()
    .tasks.filter(
      (task) => task.checklist_id === checklistId && !task.is_archived,
    )
    .sort((a, b) => a.position - b.position);
}

function toOutletAssignment(assignment: DbAssignment): OutletAssignment {
  return {
    id: assignment.id,
    checklist_id: assignment.checklist_id,
    outlet: { id: assignment.outlet_id, name: assignment.outlet_name },
    is_active: assignment.is_active,
  };
}

function activeAssignments(checklistId: number): DbAssignment[] {
  return checklistState().assignments.filter(
    (assignment) =>
      assignment.checklist_id === checklistId && assignment.is_active,
  );
}

type ScheduleFields = Pick<
  Checklist,
  | 'name'
  | 'recurrence'
  | 'st_time'
  | 'deadline_minutes'
  | 'weekdays'
  | 'day_of_month'
  | 'interval_hours'
  | 'last_run_time'
>;

/** §5: the shape of a schedule, then the window against the next run. */
function assertValidSchedule(schedule: ScheduleFields) {
  const invalid = (message: string, field: string) =>
    apiError(400, API_ERROR_CODE.VALIDATION_ERROR, message, field);

  if (!schedule.name.trim()) throw invalid('Name is required.', 'name');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.st_time)) {
    throw invalid('Use a time like 06:30.', 'st_time');
  }
  if (
    !Number.isInteger(schedule.deadline_minutes) ||
    schedule.deadline_minutes < MIN_WINDOW_MINUTES
  ) {
    throw invalid(
      `The window must be at least ${MIN_WINDOW_MINUTES} minutes.`,
      'deadline_minutes',
    );
  }

  const weekdays = schedule.weekdays ?? [];
  if (schedule.recurrence === 'WEEKLY') {
    if (
      weekdays.length === 0 ||
      weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
    ) {
      throw invalid('Choose at least one day.', 'weekdays');
    }
  } else if (weekdays.length > 0) {
    throw invalid('Days apply to weekly checklists only.', 'weekdays');
  }

  if (schedule.recurrence === 'MONTHLY') {
    const day = schedule.day_of_month;
    if (day === null || !Number.isInteger(day) || day < 1 || day > 31) {
      throw invalid('Choose a day of the month.', 'day_of_month');
    }
  } else if (schedule.day_of_month !== null) {
    throw invalid(
      'A day of the month applies to monthly checklists only.',
      'day_of_month',
    );
  }

  if (schedule.recurrence === 'HOURLY') {
    const { interval_hours: every, last_run_time: last } = schedule;
    if (
      every === null ||
      !(HOURLY_INTERVALS as readonly number[]).includes(every)
    ) {
      throw invalid('Choose every 1, 2 or 3 hours.', 'interval_hours');
    }
    if (last === null) {
      throw invalid('Required for an hourly checklist.', 'last_run_time');
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(last)) {
      throw invalid('Use a time like 21:00.', 'last_run_time');
    }
    const minutes = (hhmm: string) =>
      Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
    if (!isRunTime(minutes(schedule.st_time), minutes(last), every)) {
      throw invalid(
        'The last run must be a run: a whole number of intervals after the first.',
        'last_run_time',
      );
    }
  } else {
    if (schedule.interval_hours !== null) {
      throw invalid('Only for an hourly checklist.', 'interval_hours');
    }
    if (schedule.last_run_time !== null) {
      throw invalid('Only for an hourly checklist.', 'last_run_time');
    }
  }

  if (
    windowOverlapsNextRun(
      schedule.recurrence,
      schedule.weekdays,
      schedule.deadline_minutes,
      schedule.interval_hours,
    )
  ) {
    throw apiError(
      409,
      API_ERROR_CODE.WINDOW_OVERLAPS_NEXT_PERIOD,
      'The window can be at most as long as the gap between runs.',
      'deadline_minutes',
    );
  }
}

/**
 * GET /checklists — scoped to what the caller can see (§5): ADMIN/OWNER get
 * every checklist, anyone else only those where they are CL_ADMIN or CL_IMP.
 * Archived ones are left out unless an admin asks for them, and then only they
 * come back (CHK-10), so the Archived filter is the server's to apply.
 */
export async function mockListChecklists(
  page: number,
  pageSize: number,
  { archivedOnly = false }: { archivedOnly?: boolean } = {},
): Promise<Page<ChecklistListItem>> {
  await delay();
  const me = resolveMe();
  const admin = new Set(me.memberships.cl_admin_assignments);
  const implementer = new Set(me.memberships.cl_imp_assignments);
  const state = checklistState();
  const mayAdminister = canAdminister(me.user.tenant_role);

  const all: ChecklistListItem[] = [];
  for (const checklist of state.checklists) {
    if (checklist.tenant_id !== me.business.id) continue;
    if (checklist.is_archived && !(archivedOnly && mayAdminister)) continue;
    if (archivedOnly && !checklist.is_archived) continue;
    const assignments = activeAssignments(checklist.id).map((a) => ({
      id: a.id,
      outlet_name: a.outlet_name,
      score: a.score,
      my_role: admin.has(a.id)
        ? ('CL_ADMIN' as const)
        : implementer.has(a.id)
          ? ('CL_IMP' as const)
          : null,
    }));
    if (mayAdminister) {
      all.push({
        ...toChecklist(checklist),
        assignments,
        task_count: liveTasks(checklist.id).length,
        outlet_count: assignments.length,
      });
    } else if (assignments.some((a) => a.my_role)) {
      all.push({
        ...toChecklist(checklist),
        assignments: assignments.filter((a) => a.my_role),
      });
    }
  }

  // An admin's lists are ordered by opening time, so paging does not reshuffle.
  if (mayAdminister) {
    all.sort(
      (a, b) =>
        a.st_time.localeCompare(b.st_time) || a.name.localeCompare(b.name),
    );
  }

  const start = (page - 1) * pageSize;
  return {
    count: all.length,
    next: start + pageSize < all.length ? page + 1 : null,
    previous: page > 1 ? page - 1 : null,
    results: all.slice(start, start + pageSize),
  };
}

/** GET /checklists/{id} — detail with its tasks, in order. */
export async function mockGetChecklist(id: number): Promise<ChecklistDetail> {
  await delay();
  const me = resolveMe();
  const checklist = findReadableChecklist(me, id);
  return { ...toChecklist(checklist), tasks: liveTasks(id).map(toTask) };
}

/** POST /checklists. A name of "offline" stands in for the network dying. */
export async function mockCreateChecklist(
  request: CreateChecklistRequest,
): Promise<Checklist> {
  await delay();
  const me = requireAdmin();
  const schedule: ScheduleFields = {
    ...request,
    name: request.name.trim(),
    weekdays: request.weekdays ?? null,
    day_of_month: request.day_of_month ?? null,
    interval_hours: request.interval_hours ?? null,
    last_run_time: request.last_run_time ?? null,
  };
  assertReachable(schedule.name);
  assertValidSchedule(schedule);
  const state = checklistState();
  const checklist: DbChecklist = {
    ...schedule,
    id: Math.max(0, ...state.checklists.map((c) => c.id)) + 1,
    tenant_id: me.business.id,
    is_archived: false,
  };
  state.checklists.push(checklist);
  return toChecklist(checklist);
}

/**
 * PATCH /checklists/{id} — name and schedule. Switching recurrence drops the
 * days the new one has no use for, so the caller need not send explicit nulls.
 */
export async function mockUpdateChecklist(
  id: number,
  request: UpdateChecklistRequest,
): Promise<Checklist> {
  await delay();
  const me = requireAdmin();
  const checklist = findEditableChecklist(me, id);
  const next: ScheduleFields = { ...checklist, ...request };
  if (request.name !== undefined) next.name = request.name.trim();
  if (next.recurrence !== 'WEEKLY' && request.weekdays === undefined) {
    next.weekdays = null;
  }
  if (next.recurrence !== 'MONTHLY' && request.day_of_month === undefined) {
    next.day_of_month = null;
  }
  if (next.recurrence !== 'HOURLY') {
    if (request.interval_hours === undefined) next.interval_hours = null;
    if (request.last_run_time === undefined) next.last_run_time = null;
  }
  assertReachable(next.name);
  assertValidSchedule(next);
  Object.assign(checklist, next);
  return toChecklist(checklist);
}

/**
 * POST /checklists/{id}/archive. No further runs anywhere; history stays. One-way:
 * there is no restore (API §5 and §16).
 */
export async function mockArchiveChecklist(id: number): Promise<Checklist> {
  await delay();
  const me = requireAdmin();
  const checklist = findChecklist(me.business.id, id);
  checklist.is_archived = true;
  return toChecklist(checklist);
}

/** Per-field rules for a task (§5); NUMBER-only fields are 400 on any other. */
function assertValidTask(task: {
  answer_type: Task['answer_type'];
  text: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  weight: number;
  requires_comment_on_fail: boolean;
}) {
  const invalid = (message: string, field: string) =>
    apiError(400, API_ERROR_CODE.VALIDATION_ERROR, message, field);

  if (task.requires_comment_on_fail && task.answer_type === 'IMAGE') {
    throw invalid(
      'Only for a Yes/No or a reading.',
      'requires_comment_on_fail',
    );
  }
  if (!task.text.trim()) throw invalid('Task text is required.', 'text');
  // Stands in for the platform refusing a text the client thought was fine.
  if (task.text.trim().toLowerCase() === 'rejected') {
    throw invalid("This text can't be saved.", 'text');
  }
  if (!Number.isInteger(task.weight) || task.weight < 1 || task.weight > 10) {
    throw invalid('Weight is 1 to 10.', 'weight');
  }
  if (task.answer_type !== 'NUMBER') {
    if (task.unit !== null) throw invalid('Only a reading has a unit.', 'unit');
    if (task.min_value !== null || task.max_value !== null) {
      throw invalid('Only a reading has limits.', 'min_value');
    }
    return;
  }
  if (
    task.min_value !== null &&
    task.max_value !== null &&
    task.min_value > task.max_value
  ) {
    throw invalid('The lowest must not be above the highest.', 'min_value');
  }
}

function findTask(tenantId: number, id: number): DbTask {
  const task = checklistState().tasks.find(
    (candidate) =>
      candidate.id === id &&
      candidate.tenant_id === tenantId &&
      !candidate.is_archived,
  );
  if (!task) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return task;
}

/** GET /checklists/{id}/tasks — ordered. */
export async function mockListTasks(checklistId: number): Promise<Task[]> {
  await delay();
  const me = resolveMe();
  findReadableChecklist(me, checklistId);
  return liveTasks(checklistId).map(toTask);
}

/** POST /checklists/{id}/tasks — added at the end. */
export async function mockCreateTask(
  checklistId: number,
  request: CreateTaskRequest,
): Promise<Task> {
  await delay();
  const me = requireAdmin();
  const checklist = findEditableChecklist(me, checklistId);
  const fields = {
    answer_type: request.answer_type,
    text: request.text.trim(),
    unit: request.unit ?? null,
    min_value: request.min_value ?? null,
    max_value: request.max_value ?? null,
    weight: request.weight ?? DEFAULT_WEIGHT,
    // A failed Yes/No or reading always needs a comment; a photograph takes none.
    requires_comment_on_fail: request.answer_type !== 'IMAGE',
  };
  assertReachable(fields.text);
  assertValidTask(fields);
  const state = checklistState();
  const task: DbTask = {
    ...fields,
    id: state.nextTaskId++,
    tenant_id: me.business.id,
    checklist_id: checklist.id,
    position: liveTasks(checklist.id).length + 1,
    is_archived: false,
  };
  state.tasks.push(task);
  return toTask(task);
}

/** PATCH /tasks/{id}. The answer type is not editable. */
export async function mockUpdateTask(
  id: number,
  request: UpdateTaskRequest,
): Promise<Task> {
  await delay();
  const me = requireAdmin();
  const task = findTask(me.business.id, id);
  findEditableChecklist(me, task.checklist_id);
  const next = {
    answer_type: task.answer_type,
    text: request.text === undefined ? task.text : request.text.trim(),
    unit: request.unit === undefined ? task.unit : request.unit,
    min_value:
      request.min_value === undefined ? task.min_value : request.min_value,
    max_value:
      request.max_value === undefined ? task.max_value : request.max_value,
    weight: request.weight ?? task.weight,
    requires_comment_on_fail: task.answer_type !== 'IMAGE',
  };
  assertReachable(next.text);
  assertValidTask(next);
  Object.assign(task, next);
  return toTask(task);
}

/** POST /tasks/{id}/archive. A task named "offline" fails as the network would. */
export async function mockArchiveTask(id: number): Promise<void> {
  await delay();
  const me = requireAdmin();
  const task = findTask(me.business.id, id);
  assertReachable(task.text);
  findEditableChecklist(me, task.checklist_id);
  task.is_archived = true;
  liveTasks(task.checklist_id).forEach((live, index) => {
    live.position = index + 1;
  });
}

/**
 * POST /checklists/{id}/tasks/reorder — every live task, once. A list holding
 * a task named "offline" fails as the network would.
 */
export async function mockReorderTasks(
  checklistId: number,
  request: ReorderTasksRequest,
): Promise<Task[]> {
  await delay();
  const me = requireAdmin();
  findEditableChecklist(me, checklistId);
  const live = liveTasks(checklistId);
  live.forEach((task) => assertReachable(task.text));
  const ids = request.task_ids;
  const same =
    ids.length === live.length &&
    new Set(ids).size === ids.length &&
    live.every((task) => ids.includes(task.id));
  if (!same) {
    throw apiError(
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
      'List every task exactly once.',
      'task_ids',
    );
  }
  ids.forEach((taskId, index) => {
    live.find((task) => task.id === taskId)!.position = index + 1;
  });
  return liveTasks(checklistId).map(toTask);
}

/**
 * GET /checklists/{id}/assignments — every outlet it runs or ran at. Inactive
 * rows come back too, flagged, so a re-tick can find the people it had.
 */
export async function mockListAssignments(
  checklistId: number,
): Promise<OutletAssignment[]> {
  await delay();
  const me = resolveMe();
  findReadableChecklist(me, checklistId);
  return assignmentsOf(checklistId).map(toOutletAssignment);
}

/** Every assignment of a checklist, by outlet name, as the platform lists them. */
function assignmentsOf(checklistId: number): DbAssignment[] {
  return checklistState()
    .assignments.filter((a) => a.checklist_id === checklistId)
    .sort((a, b) => a.outlet_name.localeCompare(b.outlet_name) || a.id - b.id);
}

/**
 * POST /checklists/{id}/assignments — bulk. An outlet already running is left
 * alone; one that was stopped starts again with the people it had. The answer is
 * every assignment of the checklist; a row this call switched back on lists, as
 * `returning_members`, the people who were still on it.
 */
export async function mockCreateAssignments(
  checklistId: number,
  request: CreateAssignmentsRequest,
): Promise<OutletAssignment[]> {
  await delay();
  const me = requireAdmin();
  const checklist = findEditableChecklist(me, checklistId);
  const state = checklistState();
  const outlets = request.outlet_ids.map((outletId) => {
    const outlet = findOutlet(me.business.id, outletId);
    if (outlet.is_archived) {
      throw apiError(409, 'archived', "Can't be edited while archived.");
    }
    return outlet;
  });

  const switchedOn = new Set<number>();
  for (const outlet of outlets) {
    const existing = state.assignments.find(
      (a) => a.checklist_id === checklist.id && a.outlet_id === outlet.id,
    );
    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        switchedOn.add(existing.id);
      }
      continue;
    }
    state.assignments.push({
      id: Math.max(0, ...state.assignments.map((a) => a.id)) + 1,
      tenant_id: me.business.id,
      checklist_id: checklist.id,
      outlet_id: outlet.id,
      outlet_name: outlet.name,
      score: null,
      is_active: true,
    });
  }

  return assignmentsOf(checklist.id).map((assignment) => ({
    ...toOutletAssignment(assignment),
    returning_members: switchedOn.has(assignment.id)
      ? returningOf(me.business.id, assignment.id)
      : [],
  }));
}

function findAssignment(tenantId: number, id: number): DbAssignment {
  const assignment = checklistState().assignments.find(
    (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
  );
  if (!assignment) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return assignment;
}

/** DELETE /assignments/{id} — deactivates: history survives, no further runs. */
export async function mockDeactivateAssignment(id: number): Promise<void> {
  await delay();
  const me = requireAdmin();
  findAssignment(me.business.id, id).is_active = false;
}

/** The part the caller plays on one assignment; null for an admin on neither. */
function callerRole(
  me: MeResponse,
  assignmentId: number,
): 'CL_ADMIN' | 'CL_IMP' | null {
  if (me.memberships.cl_admin_assignments.includes(assignmentId)) {
    return 'CL_ADMIN';
  }
  if (me.memberships.cl_imp_assignments.includes(assignmentId)) {
    return 'CL_IMP';
  }
  return null;
}

const MEMBERSHIP_KEY = {
  CL_ADMIN: 'cl_admin_assignments',
  CL_IMP: 'cl_imp_assignments',
} as const;

/** An assignment the caller can see at all; anyone else gets a 404. */
function findAssignmentForTeam(me: MeResponse, id: number): DbAssignment {
  const assignment = findAssignment(me.business.id, id);
  if (!canAdminister(me.user.tenant_role) && !callerRole(me, id)) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  return assignment;
}

/**
 * Reading who is on it: an ADMIN or OWNER, or this assignment's own Checklist
 * Manager. An implementer works the checklist and is not shown the team.
 */
function findAssignmentForTeamRead(me: MeResponse, id: number): DbAssignment {
  const assignment = findAssignmentForTeam(me, id);
  if (
    !canAdminister(me.user.tenant_role) &&
    callerRole(me, id) !== 'CL_ADMIN'
  ) {
    throw apiError(
      403,
      API_ERROR_CODE.NOT_YOUR_ASSIGNMENT,
      "Only an admin or this checklist's supervisor sees its team.",
    );
  }
  return assignment;
}

/**
 * Whether the caller may change someone in this role: ADMIN/OWNER either, a
 * CL_ADMIN implementers only, and only on assignments they supervise (§6).
 */
function assertMayChangeTeam(
  me: MeResponse,
  assignmentId: number,
  role: 'CL_ADMIN' | 'CL_IMP',
) {
  if (canAdminister(me.user.tenant_role)) return;
  if (callerRole(me, assignmentId) === 'CL_ADMIN' && role === 'CL_IMP') return;
  throw apiError(
    403,
    API_ERROR_CODE.NOT_YOUR_ASSIGNMENT,
    'Not permitted to change this team.',
  );
}

/**
 * The people on an assignment in two buckets, each by username. With
 * `includeRemoved`, `removed` lists those taken off, the latest first.
 */
function teamOf(
  tenantId: number,
  assignmentId: number,
  includeRemoved = false,
): Team {
  const person = (entry: MemberLogEntry): TeamPerson => {
    const user = db.users.find((u) => u.id === entry.user_id)!;
    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      is_active: user.is_active,
    };
  };
  const log = checklistState().memberLog.filter(
    (entry) =>
      entry.tenant_id === tenantId && entry.assignment_id === assignmentId,
  );
  const current = log.filter((entry) => entry.removed_at === null);
  const bucket = (role: 'CL_ADMIN' | 'CL_IMP') =>
    current
      .filter((entry) => entry.role === role)
      .map(person)
      .sort((a, b) => a.username.localeCompare(b.username));
  const team: Team = {
    cl_admins: bucket('CL_ADMIN'),
    cl_imps: bucket('CL_IMP'),
  };
  if (!includeRemoved) return team;
  team.removed = log
    .filter((entry) => entry.removed_at !== null)
    .sort((a, b) => (b.removed_at ?? '').localeCompare(a.removed_at ?? ''))
    .map((entry): RemovedTeamPerson => {
      const by = entry.removed_by
        ? db.users.find((u) => u.id === entry.removed_by)
        : undefined;
      return {
        ...person(entry),
        role: entry.role,
        removed_at: entry.removed_at!,
        removed_by: by ? { id: by.id, full_name: by.full_name } : null,
      };
    });
  return team;
}

/** The people still on a switched-back-on assignment: supervisors first. */
function returningOf(tenantId: number, assignmentId: number) {
  const team = teamOf(tenantId, assignmentId);
  return [
    ...team.cl_admins.map((p) => ({ ...p, role: 'CL_ADMIN' as const })),
    ...team.cl_imps.map((p) => ({ ...p, role: 'CL_IMP' as const })),
  ].map((p) => ({ user_id: p.id, full_name: p.full_name, role: p.role }));
}

/** GET /assignments/{id}/members — both buckets. */
export async function mockListMembers(
  assignmentId: number,
  { includeRemoved = false }: { includeRemoved?: boolean } = {},
): Promise<Team> {
  await delay();
  const me = resolveMe();
  findAssignmentForTeamRead(me, assignmentId);
  return teamOf(me.business.id, assignmentId, includeRemoved);
}

/**
 * GET /assignments/{id}/candidates — active people with no place on the
 * assignment, by username. Open to whoever may read the team.
 */
export async function mockListCandidates(
  assignmentId: number,
  query: CandidatesQuery,
): Promise<Page<Candidate>> {
  await delay();
  const me = resolveMe();
  findAssignmentForTeamRead(me, assignmentId);
  const team = teamOf(me.business.id, assignmentId);
  const onIt = new Set(
    [...team.cl_admins, ...team.cl_imps].map((person) => person.id),
  );
  const needle = query.search?.trim().toLowerCase();
  const matches = db.users
    .filter((user) => user.tenant_id === me.business.id && user.is_active)
    .filter((user) => !onIt.has(user.id))
    .filter(
      (user) =>
        !needle ||
        user.full_name.toLowerCase().includes(needle) ||
        user.username.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.username.localeCompare(b.username) || a.id - b.id);
  const pageSize = Math.min(Math.max(query.pageSize, 1), 100);
  const start = (query.page - 1) * pageSize;
  if (query.page > 1 && start >= matches.length) {
    throw apiError(404, 'not_found', 'Not found.');
  }
  return {
    count: matches.length,
    next: start + pageSize < matches.length ? query.page + 1 : null,
    previous: query.page > 1 ? query.page - 1 : null,
    results: matches
      .slice(start, start + pageSize)
      .map(({ id, username, full_name }) => ({ id, username, full_name })),
  };
}

/**
 * POST /assignments/{id}/members. 409 `role_conflict` when the person is
 * already on it in either role: one row per person per assignment (Schema).
 * Someone taken off before is added back on the same row. The answer is the
 * team, as GET gives it.
 */
export async function mockAddMember(
  assignmentId: number,
  request: AddMemberRequest,
): Promise<Team> {
  await delay();
  const me = resolveMe();
  const assignment = findAssignmentForTeam(me, assignmentId);
  assertMayChangeTeam(me, assignmentId, request.role);
  findEditableChecklist(me, assignment.checklist_id);

  const user = db.users.find(
    (candidate) =>
      candidate.id === request.user_id &&
      candidate.tenant_id === me.business.id,
  );
  if (!user || !user.is_active) {
    throw apiError(
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
      'Choose someone from the list.',
      'user_id',
    );
  }
  const log = checklistState().memberLog;
  const row = log.find(
    (entry) =>
      entry.assignment_id === assignmentId && entry.user_id === user.id,
  );
  if (row && row.removed_at === null) {
    throw apiError(
      409,
      API_ERROR_CODE.ROLE_CONFLICT,
      'Already on this checklist here.',
      'user_id',
    );
  }
  const now = new Date().toISOString();
  if (row) {
    row.role = request.role;
    row.added_at = now;
    row.removed_at = null;
    row.removed_by = null;
  } else {
    log.push({
      tenant_id: me.business.id,
      assignment_id: assignmentId,
      user_id: user.id,
      role: request.role,
      added_at: now,
      removed_at: null,
      removed_by: null,
    });
  }
  user.memberships[MEMBERSHIP_KEY[request.role]].push(assignmentId);
  return teamOf(me.business.id, assignmentId);
}

/**
 * DELETE /assignments/{id}/members/{user_id}. Nobody is deleted: the row keeps
 * when and by whom, and the person loses what the team gave them.
 */
export async function mockRemoveMember(
  assignmentId: number,
  userId: number,
): Promise<void> {
  await delay();
  const me = resolveMe();
  const assignment = findAssignmentForTeam(me, assignmentId);
  const row = checklistState().memberLog.find(
    (entry) =>
      entry.assignment_id === assignmentId &&
      entry.user_id === userId &&
      entry.removed_at === null,
  );
  if (!row) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  assertMayChangeTeam(me, assignmentId, row.role);
  findEditableChecklist(me, assignment.checklist_id);

  row.removed_at = new Date().toISOString();
  row.removed_by = me.user.id;
  const user = db.users.find((candidate) => candidate.id === userId)!;
  const key = MEMBERSHIP_KEY[row.role];
  user.memberships[key] = user.memberships[key].filter(
    (id) => id !== assignmentId,
  );
}

/**
 * PATCH /run-tasks/{id} — one answer, written as it is given (§7).
 *
 * Enforces the platform's rules so the screens meet them: writes outside a
 * window are 409 `window_closed`, a supervisor's write is 403, and a failing
 * answer on a task that wants one is 400 `comment_required_on_failure`.
 */
export async function mockAnswerTask(
  id: number,
  request: AnswerTaskRequest,
): Promise<RunTask> {
  await delay();
  const me = resolveMe();
  const assignmentId = Math.floor(id / 1000);
  const run = buildRuns(me, { includeClosed: true }).find(
    (candidate) => Math.floor(candidate.id / 100) === assignmentId,
  );
  if (!run) throw apiError(404, 'not_found', 'Not found.');
  if (run.my_role !== 'CL_IMP') {
    throw apiError(
      403,
      'supervisors_cannot_answer',
      'A Checklist Manager cannot answer.',
    );
  }
  if (
    new Date(run.window_open).getTime() > Date.now() ||
    new Date(run.window_close).getTime() <= Date.now()
  ) {
    throw apiError(409, 'window_closed', 'This checklist is not open.');
  }

  const templates = TASK_TEMPLATES[assignmentId] ?? [];
  const index = (id % 1000) - 1;
  const task = templates[index];
  if (!task) throw apiError(404, 'not_found', 'Not found.');

  const existing = db.answers.get(id);
  const next = { ...existing, ...request } as AnswerTaskRequest;

  if (task.type === 'BINARY' || task.type === 'NUMBER') {
    const fails =
      (task.type === 'BINARY' && next.answer_bool === false) ||
      (task.type === 'NUMBER' &&
        next.answer_number !== undefined &&
        ((task.min !== undefined && next.answer_number < task.min) ||
          (task.max !== undefined && next.answer_number > task.max)));
    if (fails && !next.comment) {
      throw apiError(
        400,
        API_ERROR_CODE.COMMENT_REQUIRED_ON_FAILURE,
        'A comment is required when something fails.',
        'comment',
      );
    }
  }

  db.answers.set(id, next);
  if (task.type === 'IMAGE' && request.image_key !== undefined) {
    startJudgement(id);
  }
  const built = buildTasks(assignmentId, run.answered_count, run.window_open);
  const answered = built.find((candidate) => candidate.id === id);
  if (!answered) throw apiError(404, 'not_found', 'Not found.');
  return answered;
}

/** Runs whose first upload has been refused already, so the retry goes through. */
const refusedUploadRuns = new Set<number>();

/** A name or prompt of `revoked` stands for the role having been taken away: a 403 on the write. */
function triggerRevoked(text?: string | null) {
  if (text !== undefined && text !== null && isPromptTrigger(text, 'revoked')) {
    throw apiError(
      403,
      API_ERROR_CODE.PERMISSION_DENIED,
      'Your role no longer allows this.',
    );
  }
}

/** A capture prompt written as a trigger word (`upload`, `slow`, `revoked`), as in Week 8. */
function isPromptTrigger(prompt: string, word: string): boolean {
  return prompt.trim().toLowerCase() === word;
}

/**
 * POST /uploads/sign — §8. Returns a location the client PUTs to. The mock
 * cannot accept real bytes; the key is recorded so the PATCH that follows
 * the upload carries it.
 */
export async function mockSignUpload(
  request: UploadSignRequest,
): Promise<UploadSignResponse> {
  await delay();
  // A signature needs the network: with no signal there is no upload location
  // (a spot-check photograph is then kept on the phone, SPT-01 `noUploadUrl`).
  if (request.purpose === 'spot_check_run' && !onlineManager.isOnline()) {
    throw new Error('Network request failed');
  }
  const me = resolveMe();
  const key = `t${me.business.id}/mock/${request.target_id}-${Date.now()}.jpg`;
  db.signedUploadKeys.set(request.target_id, key);
  // A run with a prompt of `upload`: the first photograph's bytes are refused, so
  // the prompt shows Retry (SPT-01 `uploadFailed`); the retry goes through.
  if (
    request.purpose === 'spot_check_run' &&
    !refusedUploadRuns.has(request.target_id) &&
    spotCheckState()
      .runs.find((run) => run.id === request.target_id)
      ?.captures.some((capture) => isPromptTrigger(capture.prompt, 'upload'))
  ) {
    refusedUploadRuns.add(request.target_id);
    return {
      upload_url: `mock://refuse/${key}`,
      method: 'PUT',
      headers: { 'content-type': request.content_type },
      key,
    };
  }
  return {
    upload_url: `mock://storage/${key}`,
    method: 'PUT',
    headers: { 'content-type': request.content_type },
    key,
  };
}

// ---------------------------------------------------------------------------
// Week 8 — attendance (API Contract §11) and inventory (§12)
//
// Failure triggers, so the error states can be reached by hand:
//   a name, note or search of "offline" — the network dies (a save that cannot send)
//   a name, note or search of "fault"   — a 500 (save failed, load failed, row failed)
// A module that is off answers 404; a role that was lost answers 403.
// ---------------------------------------------------------------------------

function triggerFault(text?: string | null) {
  const value = text?.trim().toLowerCase();
  if (value === 'offline') throw new Error('Network request failed');
  if (value === 'fault') {
    throw apiError(500, 'server_error', 'Server fault.');
  }
}

function invalid(message: string, field: string) {
  return apiError(400, API_ERROR_CODE.VALIDATION_ERROR, message, field);
}

/** Like the platform: a page size above 100 is cut to 100, a page past the end is 404. */
function paginate<T>(matches: T[], page: number, pageSize: number): Page<T> {
  const size = Math.min(Math.max(pageSize, 1), 100);
  const start = (page - 1) * size;
  if (page > 1 && start >= matches.length) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  return {
    count: matches.length,
    next: start + size < matches.length ? page + 1 : null,
    previous: page > 1 ? page - 1 : null,
    results: matches.slice(start, start + size),
  };
}

const MINUTE_MS = 60_000;

/** The device's local day, as the YYYY-MM-DD the platform's `from`/`to` take. */
function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `hhmm` on the local day `daysAgo` days back. */
function localTime(daysAgo: number, hhmm: string): Date {
  const moment = new Date();
  moment.setHours(Number(hhmm.slice(0, 2)), Number(hhmm.slice(3)), 0, 0);
  moment.setDate(moment.getDate() - daysAgo);
  return moment;
}

function parseDay(value: string, field: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const moment = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : null;
  if (!moment || Number.isNaN(moment.getTime())) {
    throw invalid('Use a date like 2026-10-14.', field);
  }
  return moment;
}

/** `from` starts its day, `to` takes in all of its day; `to` before `from` is refused. */
function dayRange(from?: string, to?: string) {
  const start = from ? parseDay(from, 'from') : null;
  const end = to ? parseDay(to, 'to') : null;
  if (end) end.setHours(23, 59, 59, 999);
  if (start && end && end.getTime() < start.getTime()) {
    throw invalid('The end date cannot be before the start date.', 'to');
  }
  return { fromMs: start?.getTime() ?? null, toMs: end?.getTime() ?? null };
}

function userRef(id: number | null) {
  if (id === null) return null;
  const user = db.users.find((candidate) => candidate.id === id);
  return user ? { id: user.id, full_name: user.full_name } : null;
}

/** Cheap, repeatable 0–99 from two ids, so a year of history looks lived in but never changes. */
function pseudo(a: number, b: number): number {
  return Math.abs(Math.imul(a, 2654435761) ^ Math.imul(b, 40503)) % 100;
}

// --- attendance ------------------------------------------------------------

type DbStaff = Staff & { tenant_id: number };

type DbAttendanceConfig = Omit<AttendanceConfig, 'managers'> & {
  tenant_id: number;
  manager_ids: number[];
};

type DbMark = {
  id: number;
  staff_id: number;
  status: AttendanceMarkStatus;
  source: AttendanceMark['source'];
  note: string | null;
  marked_by_id: number | null;
  marked_at: string | null;
  changes: AttendanceMarkChange[];
};

type DbSession = {
  id: number;
  tenant_id: number;
  config_id: number;
  /** The local day it belongs to: one session per config per day. */
  period: string;
  window_open: string;
  window_close: string;
  status: 'OPEN' | 'FINALIZED';
  finalized_at: string | null;
  marks: DbMark[];
};

type AttendanceState = {
  staff: DbStaff[];
  configs: DbAttendanceConfig[];
  sessions: DbSession[];
  nextStaffId: number;
  nextConfigId: number;
};

/**
 * Today's window as minutes from when the app started (like the run fixtures), so
 * there is always something open, and something that has just closed, to try.
 * Evening and Kitchen keep their real clock times.
 */
const TODAY_FROM_NOW: Record<number, { open: number; close: number }> = {
  2: { open: -20, close: 40 },
  3: { open: -10, close: 50 },
  4: { open: -150, close: -60 },
};

/** How many people are already marked present when today's session opens. */
const TODAY_PREMARKED: Record<number, number> = { 2: 8, 3: 3, 4: 9 };

/** Morning at ZamZam has a year behind it: 200 sessions, spread over 365 days. */
function historyDays(configId: number): number[] {
  if (configId !== 2) return [1, 2, 3, 4, 5, 6, 7];
  const days: number[] = [];
  for (let day = 1; day <= 365; day++) {
    if (Math.floor((day * 200) / 365) !== Math.floor(((day - 1) * 200) / 365)) {
      days.push(day);
    }
  }
  return days;
}

/** 120 people at Central Kitchen, so a roster runs past one page of 25. */
function kitchenStaff(): DbStaff[] {
  return Array.from({ length: 120 }, (_, index) => ({
    id: 201 + index,
    tenant_id: 7,
    full_name: `${STAFF_FIRST_NAMES[index % STAFF_FIRST_NAMES.length]} ${
      STAFF_LAST_NAMES[
        Math.floor(index / STAFF_FIRST_NAMES.length) % STAFF_LAST_NAMES.length
      ]
    }`,
    staff_code: `CK-${String(index + 1).padStart(3, '0')}`,
    is_archived: false,
    outlets: [{ outlet_id: 12, is_active: true }],
  }));
}

function windowFor(config: DbAttendanceConfig, daysAgo: number) {
  const rolling = daysAgo === 0 ? TODAY_FROM_NOW[config.id] : undefined;
  const open = rolling
    ? new Date(db.startedAt + rolling.open * MINUTE_MS)
    : localTime(daysAgo, config.st_time);
  const close = rolling
    ? new Date(db.startedAt + rolling.close * MINUTE_MS)
    : new Date(open.getTime() + config.deadline_minutes * MINUTE_MS);
  return { open, close };
}

/** Who is on the roster of an outlet when a session opens, by name. */
function rosterAt(
  state: AttendanceState,
  outletId: number,
  daysAgo: number,
): DbStaff[] {
  return state.staff
    .filter((person) => {
      const link = person.outlets.find((o) => o.outlet_id === outletId);
      if (!link) return false;
      if (link.is_active && !person.is_archived) return true;
      // Someone who has since left was still on the roster of an older session.
      return daysAgo > 14;
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id - b.id);
}

function pastMark(
  session: Pick<DbSession, 'id' | 'window_open' | 'window_close'>,
  person: DbStaff,
  managerId: number,
): DbMark {
  const roll = pseudo(session.id, person.id);
  const open = new Date(session.window_open).getTime();
  const close = new Date(session.window_close).getTime();
  const marker = roll < 88 ? managerId : null;
  const markedAt =
    marker === null
      ? session.window_close
      : new Date(
          Math.min(open + (5 + (roll % 40)) * MINUTE_MS, close),
        ).toISOString();
  const present = roll < 80;
  const corrected = roll >= 70 && roll < 73;
  return {
    id: session.id * 1000 + person.id,
    staff_id: person.id,
    status: present ? 'PRESENT' : 'NOT_PRESENT',
    source: marker === null ? 'SYSTEM' : 'MANUAL',
    note: present && roll % 23 === 0 ? 'Came late' : null,
    marked_by_id: marker,
    marked_at: markedAt,
    changes: corrected
      ? [
          {
            from_status: 'NOT_PRESENT',
            to_status: 'PRESENT',
            changed_by: managerId,
            changed_at: new Date(open + (close - open) * 0.8).toISOString(),
          },
        ]
      : [],
  };
}

function seedAttendanceState(): AttendanceState {
  const state: AttendanceState = {
    staff: [
      ...attendanceFixtures.staff.map((person) => ({
        ...person,
        tenant_id: 7,
        outlets: person.outlets.map((link) => ({ ...link })),
      })),
      ...kitchenStaff(),
    ],
    configs: attendanceFixtures.configs.map((config) => ({
      ...config,
      tenant_id: 7,
      manager_ids: [...config.manager_ids],
    })) as DbAttendanceConfig[],
    sessions: [],
    nextStaffId: 400,
    nextConfigId: 10,
  };

  for (const config of state.configs) {
    const managerId = config.manager_ids[0] ?? 4;
    for (const daysAgo of historyDays(config.id)) {
      const { open, close } = windowFor(config, daysAgo);
      const session: DbSession = {
        id: config.id * 1000 + daysAgo,
        tenant_id: config.tenant_id,
        config_id: config.id,
        period: localDay(open),
        window_open: open.toISOString(),
        window_close: close.toISOString(),
        status: 'FINALIZED',
        finalized_at: close.toISOString(),
        marks: [],
      };
      session.marks = rosterAt(state, config.outlet_id, daysAgo).map((person) =>
        pastMark(session, person, managerId),
      );
      state.sessions.push(session);
    }
  }
  return state;
}

function attendanceState(): AttendanceState {
  return (db.attendanceState ??= seedAttendanceState());
}

/** Generation: a session exists once its window has opened, one per config per day. */
function openTodaySessions(state: AttendanceState) {
  const now = Date.now();
  const today = localDay(new Date());
  for (const config of state.configs) {
    if (config.is_archived) continue;
    if (
      state.sessions.some(
        (s) => s.config_id === config.id && s.period === today,
      )
    ) {
      continue;
    }
    const { open, close } = windowFor(config, 0);
    if (open.getTime() > now) continue;
    const session: DbSession = {
      id: config.id * 1000,
      tenant_id: config.tenant_id,
      config_id: config.id,
      period: today,
      window_open: open.toISOString(),
      window_close: close.toISOString(),
      status: 'OPEN',
      finalized_at: null,
      marks: [],
    };
    const managerId = config.manager_ids[0] ?? 4;
    const premarked = TODAY_PREMARKED[config.id] ?? 0;
    session.marks = rosterAt(state, config.outlet_id, 0).map(
      (person, index) => ({
        id: session.id * 1000 + person.id,
        staff_id: person.id,
        status: index < premarked ? 'PRESENT' : 'UNMARKED',
        source: 'MANUAL',
        note: null,
        marked_by_id: index < premarked ? managerId : null,
        marked_at:
          index < premarked
            ? new Date(
                Math.min(open.getTime() + (index + 1) * 2 * MINUTE_MS, now),
              ).toISOString()
            : null,
        changes: [],
      }),
    );
    state.sessions.push(session);
  }
}

/** A read of a session past its close finalises it first: nobody-marked becomes SYSTEM. */
function finalizeOverdue(state: AttendanceState) {
  const now = Date.now();
  for (const session of state.sessions) {
    if (session.status !== 'OPEN') continue;
    if (new Date(session.window_close).getTime() > now) continue;
    for (const mark of session.marks) {
      if (mark.status !== 'UNMARKED') continue;
      mark.status = 'NOT_PRESENT';
      mark.source = 'SYSTEM';
      mark.marked_by_id = null;
      mark.marked_at = session.window_close;
    }
    session.status = 'FINALIZED';
    session.finalized_at = session.window_close;
  }
}

type AttendanceActor = {
  me: MeResponse;
  admin: boolean;
  /** Configs the caller has a manager row on. */
  managedConfigIds: Set<number>;
  /** Outlets of the configs they manage. */
  managedOutletIds: Set<number>;
};

function attendanceOutletOn(tenantId: number, outletId: number): boolean {
  return db.outlets.some(
    (outlet) =>
      outlet.id === outletId &&
      outlet.tenant_id === tenantId &&
      outlet.attendance_enabled &&
      !outlet.is_archived,
  );
}

/** 404 while no outlet has attendance on; 403 for anyone who is neither admin nor manager. */
function attendanceActor(): AttendanceActor {
  const me = resolveMe();
  const state = attendanceState();
  if (
    !db.outlets.some(
      (outlet) =>
        outlet.tenant_id === me.business.id &&
        outlet.attendance_enabled &&
        !outlet.is_archived,
    )
  ) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  const admin = canAdminister(me.user.tenant_role);
  const managed = state.configs.filter(
    (config) =>
      config.tenant_id === me.business.id &&
      !config.is_archived &&
      me.memberships.attendance_configs.includes(config.id) &&
      attendanceOutletOn(me.business.id, config.outlet_id),
  );
  if (!admin && managed.length === 0) {
    throw apiError(403, API_ERROR_CODE.PERMISSION_DENIED, 'Not permitted.');
  }
  return {
    me,
    admin,
    managedConfigIds: new Set(managed.map((config) => config.id)),
    managedOutletIds: new Set(managed.map((config) => config.outlet_id)),
  };
}

function requireAttendanceAdmin(actor: AttendanceActor) {
  if (!actor.admin) {
    throw apiError(
      403,
      API_ERROR_CODE.PERMISSION_DENIED,
      'Only an administrator can change configuration.',
    );
  }
}

/** An outlet whose attendance the caller may read; anything else looks the same: 404. */
function readableAttendanceOutlet(
  actor: AttendanceActor,
  outletId: number,
): number {
  const readable = actor.admin
    ? attendanceOutletOn(actor.me.business.id, outletId)
    : actor.managedOutletIds.has(outletId);
  if (!readable) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return outletId;
}

/** The outlets an enrolment or a new person may point at. */
function assertCanManageOutlet(actor: AttendanceActor, outletId: number) {
  const outlet = db.outlets.find(
    (candidate) =>
      candidate.id === outletId && candidate.tenant_id === actor.me.business.id,
  );
  if (!outlet) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  if (!outlet.attendance_enabled || outlet.is_archived) {
    throw invalid('Attendance is not enabled at this outlet.', 'outlet_ids');
  }
  if (!actor.admin && !actor.managedOutletIds.has(outletId)) {
    throw apiError(
      403,
      API_ERROR_CODE.PERMISSION_DENIED,
      'You do not manage attendance at this outlet.',
    );
  }
}

// staff

function visibleStaff(actor: AttendanceActor): DbStaff[] {
  return attendanceState().staff.filter(
    (person) =>
      person.tenant_id === actor.me.business.id &&
      (actor.admin ||
        person.outlets.some((link) =>
          actor.managedOutletIds.has(link.outlet_id),
        )),
  );
}

function toStaff(person: DbStaff, actor: AttendanceActor): Staff {
  return {
    id: person.id,
    full_name: person.full_name,
    staff_code: person.staff_code,
    is_archived: person.is_archived,
    // A manager does not learn where else someone works.
    outlets: person.outlets
      .filter(
        (link) => actor.admin || actor.managedOutletIds.has(link.outlet_id),
      )
      .map((link) => ({ ...link }))
      .sort((a, b) => a.outlet_id - b.outlet_id),
  };
}

function findVisibleStaff(actor: AttendanceActor, id: number): DbStaff {
  const person = visibleStaff(actor).find((candidate) => candidate.id === id);
  if (!person) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return person;
}

function cleanCode(code: string | null | undefined): string | null {
  const trimmed = code?.trim();
  return trimmed ? trimmed : null;
}

/** GET /staff — by name. An outlet filter lists the people active there. */
export async function mockListStaff(query: StaffQuery): Promise<Page<Staff>> {
  await delay();
  const actor = attendanceActor();
  triggerFault(query.search);
  const outletId =
    query.outletId === undefined
      ? undefined
      : readableAttendanceOutlet(actor, query.outletId);
  const needle = query.search?.trim().toLowerCase();
  const matches = visibleStaff(actor)
    .filter((person) => query.includeArchived || !person.is_archived)
    .filter(
      (person) =>
        outletId === undefined ||
        person.outlets.some(
          (link) => link.outlet_id === outletId && link.is_active,
        ),
    )
    .filter(
      (person) =>
        !needle ||
        person.full_name.toLowerCase().includes(needle) ||
        person.staff_code?.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id - b.id)
    .map((person) => toStaff(person, actor));
  return paginate(matches, query.page, query.pageSize);
}

/** POST /staff */
export async function mockCreateStaff(
  request: CreateStaffRequest,
): Promise<Staff> {
  await delay();
  const actor = attendanceActor();
  const fullName = request.full_name.trim();
  if (!fullName) throw invalid('Name is required.', 'full_name');
  triggerFault(fullName);
  const code = cleanCode(request.staff_code);

  const outletIds = [...new Set(request.outlet_ids ?? [])];
  if (!actor.admin && outletIds.length === 0) {
    throw invalid('Choose the outlet the person works at.', 'outlet_ids');
  }
  for (const outletId of outletIds) assertCanManageOutlet(actor, outletId);

  const state = attendanceState();
  const person: DbStaff = {
    id: state.nextStaffId++,
    tenant_id: actor.me.business.id,
    full_name: fullName,
    staff_code: code,
    is_archived: false,
    outlets: outletIds.map((outlet_id) => ({ outlet_id, is_active: true })),
  };
  state.staff.push(person);
  return toStaff(person, actor);
}

/** PATCH /staff/{id} — name, code, archive. */
export async function mockUpdateStaff(
  id: number,
  request: UpdateStaffRequest,
): Promise<Staff> {
  await delay();
  const actor = attendanceActor();
  const person = findVisibleStaff(actor, id);
  if (request.full_name !== undefined) {
    if (!request.full_name.trim())
      throw invalid('Name is required.', 'full_name');
    triggerFault(request.full_name);
  }
  const code =
    request.staff_code === undefined
      ? undefined
      : cleanCode(request.staff_code);

  const next = {
    full_name: request.full_name?.trim() ?? person.full_name,
    staff_code: code === undefined ? person.staff_code : code,
    is_archived: request.is_archived ?? person.is_archived,
  };
  const changed =
    next.full_name !== person.full_name ||
    next.staff_code !== person.staff_code ||
    next.is_archived !== person.is_archived;
  // Name, code and archive belong to the person, not to one outlet: a manager may
  // change them only while everywhere the person is active is an outlet they manage.
  const elsewhere = person.outlets.some(
    (link) => link.is_active && !actor.managedOutletIds.has(link.outlet_id),
  );
  if (!actor.admin && elsewhere && changed) {
    throw apiError(
      403,
      API_ERROR_CODE.PERMISSION_DENIED,
      'This person also works at an outlet you do not manage. Ask an admin to change their details.',
    );
  }
  Object.assign(person, next);
  return toStaff(person, actor);
}

/** POST /staff/{id}/outlets — enrol, or set whether they are active there. */
export async function mockEnrolStaff(
  id: number,
  request: EnrolStaffRequest,
): Promise<Staff> {
  await delay();
  const actor = attendanceActor();
  const person = findVisibleStaff(actor, id);
  assertCanManageOutlet(actor, request.outlet_id);
  const isActive = request.is_active ?? true;
  const link = person.outlets.find((o) => o.outlet_id === request.outlet_id);
  if (link) link.is_active = isActive;
  else
    person.outlets.push({ outlet_id: request.outlet_id, is_active: isActive });
  return toStaff(person, actor);
}

// configs

function visibleConfigs(actor: AttendanceActor): DbAttendanceConfig[] {
  return attendanceState().configs.filter(
    (config) =>
      config.tenant_id === actor.me.business.id &&
      attendanceOutletOn(config.tenant_id, config.outlet_id) &&
      (actor.admin ? true : actor.managedConfigIds.has(config.id)),
  );
}

function toConfig(config: DbAttendanceConfig): AttendanceConfig {
  const { tenant_id: _tenant, manager_ids, ...rest } = config;
  return {
    ...rest,
    managers: manager_ids
      .map((managerId) => db.users.find((user) => user.id === managerId))
      .filter((user): user is DbUser => user !== undefined)
      .sort((a, b) => a.username.localeCompare(b.username))
      .map((user) => ({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
      })),
  };
}

function findVisibleConfig(actor: AttendanceActor, id: number) {
  const config = visibleConfigs(actor).find((candidate) => candidate.id === id);
  if (!config) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return config;
}

/** An archived configuration is frozen: no edit, no appointment. */
function assertConfigLive(config: DbAttendanceConfig) {
  if (config.is_archived) {
    throw invalid(
      'This configuration is archived and can no longer be changed.',
      'config_id',
    );
  }
}

/** §11 and §5: the schedule's shape and the window against the next period. The platform has no rule on a repeated name (decision 24). */
function assertValidConfig(
  config: Pick<
    AttendanceConfig,
    | 'name'
    | 'recurrence'
    | 'st_time'
    | 'deadline_minutes'
    | 'weekdays'
    | 'day_of_month'
  >,
) {
  if ((config.recurrence as string) === 'HOURLY') {
    throw invalid('Attendance cannot repeat hourly.', 'recurrence');
  }
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(config.recurrence)) {
    throw invalid('Choose daily, weekly or monthly.', 'recurrence');
  }
  if (config.name.trim().length > 150) {
    throw invalid('Use 150 characters or fewer.', 'name');
  }
  assertValidSchedule({ ...config, interval_hours: null, last_run_time: null });
}

/** GET /attendance/configs — ADMIN/OWNER see every outlet's; a manager the ones they manage. */
export async function mockListAttendanceConfigs(
  query: AttendanceConfigsQuery,
): Promise<Page<AttendanceConfig>> {
  await delay();
  const actor = attendanceActor();
  const outletId =
    query.outletId === undefined
      ? undefined
      : readableAttendanceOutlet(actor, query.outletId);
  const matches = visibleConfigs(actor)
    .filter((config) => query.includeArchived || !config.is_archived)
    .filter((config) => outletId === undefined || config.outlet_id === outletId)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    .map(toConfig);
  return paginate(matches, query.page, query.pageSize);
}

/** POST /attendance/configs — ADMIN/OWNER only. */
export async function mockCreateAttendanceConfig(
  request: CreateAttendanceConfigRequest,
): Promise<AttendanceConfig> {
  await delay();
  const actor = attendanceActor();
  requireAttendanceAdmin(actor);
  if (!request.name.trim()) throw invalid('Name is required.', 'name');
  triggerFault(request.name);
  if (!attendanceOutletOn(actor.me.business.id, request.outlet_id)) {
    throw invalid('Attendance is not enabled at this outlet.', 'outlet_id');
  }
  const schedule = {
    name: request.name.trim(),
    recurrence: request.recurrence,
    st_time: request.st_time,
    deadline_minutes: request.deadline_minutes,
    weekdays: request.weekdays ?? null,
    day_of_month: request.day_of_month ?? null,
  };
  assertValidConfig(schedule);

  const state = attendanceState();
  const config: DbAttendanceConfig = {
    id: state.nextConfigId++,
    tenant_id: actor.me.business.id,
    outlet_id: request.outlet_id,
    method: 'MANUAL',
    is_archived: false,
    manager_ids: [],
    ...schedule,
    weekdays: schedule.weekdays && [...new Set(schedule.weekdays)].sort(),
  };
  state.configs.push(config);
  return toConfig(config);
}

/** PATCH /attendance/configs/{id} — everything but the outlet. */
export async function mockUpdateAttendanceConfig(
  id: number,
  request: UpdateAttendanceConfigRequest,
): Promise<AttendanceConfig> {
  await delay();
  const actor = attendanceActor();
  requireAttendanceAdmin(actor);
  const config = findVisibleConfig(actor, id);
  assertConfigLive(config);
  if (request.name !== undefined) triggerFault(request.name);

  const recurrence = request.recurrence ?? config.recurrence;
  // Weekdays belong to WEEKLY and a day of the month to MONTHLY: changing away from
  // one clears it, as the platform does.
  const weekdays =
    request.weekdays !== undefined
      ? request.weekdays
      : recurrence === 'WEEKLY'
        ? config.weekdays
        : null;
  const dayOfMonth =
    request.day_of_month !== undefined
      ? request.day_of_month
      : recurrence === 'MONTHLY'
        ? config.day_of_month
        : null;
  const next = {
    name: request.name?.trim() ?? config.name,
    recurrence,
    st_time: request.st_time ?? config.st_time,
    deadline_minutes: request.deadline_minutes ?? config.deadline_minutes,
    weekdays: weekdays && [...new Set(weekdays)].sort(),
    day_of_month: dayOfMonth,
  };
  assertValidConfig(next);
  Object.assign(config, next);
  return toConfig(config);
}

/** POST /attendance/configs/{id}/archive — no more sessions; past ones stay. */
export async function mockArchiveAttendanceConfig(
  id: number,
): Promise<AttendanceConfig> {
  await delay();
  const actor = attendanceActor();
  requireAttendanceAdmin(actor);
  const config = findVisibleConfig(actor, id);
  config.is_archived = true;
  return toConfig(config);
}

/** POST /attendance/configs/{id}/managers */
export async function mockAppointAttendanceManager(
  id: number,
  request: AppointManagerRequest,
): Promise<AttendanceConfig> {
  await delay();
  const actor = attendanceActor();
  requireAttendanceAdmin(actor);
  const config = findVisibleConfig(actor, id);
  assertConfigLive(config);
  const user = db.users.find(
    (candidate) =>
      candidate.id === request.user_id &&
      candidate.tenant_id === actor.me.business.id,
  );
  if (!user) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  if (!user.is_active) {
    throw invalid('A deactivated user cannot be appointed.', 'user_id');
  }
  if (!config.manager_ids.includes(user.id)) config.manager_ids.push(user.id);
  if (!user.memberships.attendance_configs.includes(config.id)) {
    user.memberships.attendance_configs.push(config.id);
  }
  return toConfig(config);
}

/** DELETE /attendance/configs/{id}/managers/{user_id} — they can be appointed again. */
export async function mockRemoveAttendanceManager(
  id: number,
  userId: number,
): Promise<void> {
  await delay();
  const actor = attendanceActor();
  requireAttendanceAdmin(actor);
  const config = findVisibleConfig(actor, id);
  assertConfigLive(config);
  if (!config.manager_ids.includes(userId)) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  config.manager_ids = config.manager_ids.filter((m) => m !== userId);
  const user = db.users.find((candidate) => candidate.id === userId);
  if (user) {
    user.memberships.attendance_configs =
      user.memberships.attendance_configs.filter((c) => c !== config.id);
  }
}

// sessions and marks

function toMark(mark: DbMark): AttendanceMark {
  const person = attendanceState().staff.find((s) => s.id === mark.staff_id)!;
  return {
    id: mark.id,
    staff: {
      id: person.id,
      full_name: person.full_name,
      staff_code: person.staff_code,
    },
    status: mark.status,
    source: mark.source,
    confidence: null,
    note: mark.note,
    marked_by: userRef(mark.marked_by_id),
    marked_at: mark.marked_at,
    changes: mark.changes.map((change) => ({ ...change })),
  };
}

function countsOf(marks: DbMark[]): AttendanceCounts {
  const count = (test: (mark: DbMark) => boolean) => marks.filter(test).length;
  return {
    total: marks.length,
    present: count((m) => m.status === 'PRESENT'),
    not_present: count(
      (m) => m.status === 'NOT_PRESENT' && m.source !== 'SYSTEM',
    ),
    not_marked: count(
      (m) => m.status === 'NOT_PRESENT' && m.source === 'SYSTEM',
    ),
    needs_review: count((m) => m.status === 'NEEDS_REVIEW'),
    unmarked: count((m) => m.status === 'UNMARKED'),
  };
}

function toSession(session: DbSession): AttendanceSession {
  const config = attendanceState().configs.find(
    (c) => c.id === session.config_id,
  )!;
  const outlet = db.outlets.find((o) => o.id === config.outlet_id)!;
  return {
    id: session.id,
    config_id: config.id,
    config_name: config.name,
    outlet_id: outlet.id,
    outlet_name: outlet.name,
    method: 'MANUAL',
    status: session.status,
    window_open: session.window_open,
    window_close: session.window_close,
    finalized_at: session.finalized_at,
    counts: countsOf(session.marks),
  };
}

/** Sessions the caller may read: every attendance outlet's, or those of their own configs. */
function visibleSessions(actor: AttendanceActor): DbSession[] {
  const state = attendanceState();
  openTodaySessions(state);
  finalizeOverdue(state);
  return state.sessions.filter((session) => {
    const config = state.configs.find((c) => c.id === session.config_id)!;
    if (
      session.tenant_id !== actor.me.business.id ||
      !attendanceOutletOn(session.tenant_id, config.outlet_id)
    ) {
      return false;
    }
    return (
      actor.admin || actor.me.memberships.attendance_configs.includes(config.id)
    );
  });
}

/** GET /attendance/sessions — newest window first. */
export async function mockListAttendanceSessions(
  query: AttendanceSessionsQuery,
): Promise<Page<AttendanceSession>> {
  await delay();
  const actor = attendanceActor();
  const outletId =
    query.outletId === undefined
      ? undefined
      : readableAttendanceOutlet(actor, query.outletId);
  const { fromMs, toMs } = dayRange(query.from, query.to);
  const now = Date.now();
  const configs = attendanceState().configs;
  const matches = visibleSessions(actor)
    .filter(
      (session) =>
        outletId === undefined ||
        configs.find((c) => c.id === session.config_id)!.outlet_id === outletId,
    )
    .filter((session) => {
      const open = new Date(session.window_open).getTime();
      const close = new Date(session.window_close).getTime();
      if (query.state === 'open' && !(open <= now && now < close)) return false;
      if (query.state === 'upcoming' && !(open > now)) return false;
      if (query.state === 'closed' && !(close <= now)) return false;
      if (fromMs !== null && open < fromMs) return false;
      if (toMs !== null && open > toMs) return false;
      return true;
    })
    .sort((a, b) => b.window_open.localeCompare(a.window_open) || b.id - a.id)
    .map(toSession);
  return paginate(matches, query.page, query.pageSize);
}

/** GET /attendance/sessions/{id} — with the roster snapshot, by name. */
export async function mockGetAttendanceSession(
  id: number,
): Promise<AttendanceSessionDetail> {
  await delay();
  const actor = attendanceActor();
  const session = visibleSessions(actor).find(
    (candidate) => candidate.id === id,
  );
  if (!session) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return { ...toSession(session), marks: session.marks.map(toMark) };
}

/**
 * PATCH /attendance/marks/{id} — marking and correcting, inside the window only
 * (409 `window_closed`). Only a manager of the session's configuration may: an
 * ADMIN or OWNER who reads the session gets 403.
 */
export async function mockMarkPerson(
  id: number,
  request: MarkPersonRequest,
): Promise<AttendanceMark> {
  await delay();
  const actor = attendanceActor();
  const sessionId = Math.floor(id / 1000);
  const session = visibleSessions(actor).find((s) => s.id === sessionId);
  const mark = session?.marks.find((candidate) => candidate.id === id);
  if (!session || !mark)
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  if (!actor.managedConfigIds.has(session.config_id)) {
    throw apiError(
      403,
      API_ERROR_CODE.NOT_YOUR_ASSIGNMENT,
      "Only this session's attendance managers can mark or correct it.",
    );
  }
  if (request.status !== 'PRESENT' && request.status !== 'NOT_PRESENT') {
    throw invalid('Mark someone present or not present.', 'status');
  }
  let note = mark.note;
  if (request.note !== undefined) {
    const trimmed = request.note?.trim() ?? null;
    if (request.note !== null && !trimmed) {
      throw invalid('A note cannot be blank.', 'note');
    }
    if (trimmed && trimmed.length > 500) {
      throw invalid('Use 500 characters or fewer.', 'note');
    }
    triggerFault(trimmed);
    note = trimmed;
  }

  const now = Date.now();
  if (
    session.status !== 'OPEN' ||
    now >= new Date(session.window_close).getTime()
  ) {
    throw apiError(
      409,
      API_ERROR_CODE.WINDOW_CLOSED,
      'This session is closed.',
    );
  }
  if (now < new Date(session.window_open).getTime()) {
    throw apiError(409, 'window_not_open', 'This session has not opened.');
  }

  const stamp = new Date(now).toISOString();
  if (mark.status !== 'UNMARKED' && mark.status !== request.status) {
    mark.changes.push({
      from_status: mark.status,
      to_status: request.status,
      changed_by: actor.me.user.id,
      changed_at: stamp,
    });
  }
  mark.status = request.status;
  mark.source = 'MANUAL';
  mark.note = note;
  mark.marked_by_id = actor.me.user.id;
  mark.marked_at = stamp;
  return toMark(mark);
}

// --- inventory -------------------------------------------------------------

type DbInventoryItem = InventoryItem & { tenant_id: number };

type DbInventoryMovement = InventoryMovement & {
  tenant_id: number;
  outlet_id: number;
};

type InventoryState = {
  items: DbInventoryItem[];
  movements: DbInventoryMovement[];
  nextItemId: number;
  nextMovementId: number;
};

const BULK_ITEM_NAMES = [
  'Sugar',
  'Salt',
  'Wheat flour',
  'Red onion',
  'Tomato',
  'Potato',
  'Green chilli',
  'Coriander',
  'Curd',
  'Butter',
  'Ghee',
  'Lentils',
  'Chickpeas',
  'Cumin',
  'Mustard seed',
  'Coconut oil',
  'Tea leaves',
  'Coffee beans',
  'Paper cups',
  'Napkins',
];
const BULK_UNITS: InventoryUnit[] = ['KG', 'KG', 'KG', 'KG', 'L', 'COUNT'];

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Books a movement against an item's balance. A COUNT is the observed total, not a
 * delta: below the balance it books the difference out, above it as arrived
 * unrecorded. Nothing here refuses a balance below zero.
 */
function bookMovement(
  state: InventoryState,
  item: DbInventoryItem,
  request: RecordMovementRequest,
  recordedAt: Date,
  recordedBy: number,
): DbInventoryMovement {
  let derivedOut: number | null = null;
  let derivedIn: number | null = null;
  let balance = item.balance;
  if (request.kind === 'ADD') balance = round3(balance + request.quantity);
  else if (request.kind === 'REMOVE')
    balance = round3(balance - request.quantity);
  else {
    const difference = round3(request.quantity - balance);
    if (difference < 0) derivedOut = -difference;
    if (difference > 0) derivedIn = difference;
    balance = request.quantity;
  }
  item.balance = balance;
  const movement: DbInventoryMovement = {
    id: state.nextMovementId++,
    tenant_id: item.tenant_id,
    outlet_id: item.outlet_id,
    item_id: item.id,
    kind: request.kind,
    quantity: request.quantity,
    unit_price: request.kind === 'ADD' ? (request.unit_price ?? null) : null,
    note: request.note ?? null,
    derived_out: derivedOut,
    derived_in: derivedIn,
    balance_after: balance,
    recorded_by: userRef(recordedBy)!,
    recorded_at: recordedAt.toISOString(),
  };
  state.movements.push(movement);
  return movement;
}

function seedInventoryState(): InventoryState {
  const state: InventoryState = {
    items: [],
    movements: [],
    nextItemId: 400,
    nextMovementId: 9001,
  };
  const seeded: { item: DbInventoryItem; opening: number | null }[] = [
    ...inventoryFixtures.items.map((fixture) => ({
      item: {
        id: fixture.id,
        tenant_id: 7,
        outlet_id: fixture.outlet_id,
        name: fixture.name,
        unit: fixture.unit as InventoryUnit,
        reference_price: fixture.reference_price,
        balance: 0,
        is_archived: false,
      },
      opening: fixture.opening,
    })),
    // 60 items at ZamZam Grande, so the list runs past one page of 25.
    ...Array.from({ length: 60 }, (_, index) => ({
      item: {
        id: 300 + index,
        tenant_id: 7,
        outlet_id: 11,
        name: `${BULK_ITEM_NAMES[index % BULK_ITEM_NAMES.length]}${
          index >= BULK_ITEM_NAMES.length
            ? ` (${index < 40 ? 'bulk' : 'organic'})`
            : ''
        }`,
        unit: BULK_UNITS[index % BULK_UNITS.length],
        reference_price: null,
        balance: 0,
        is_archived: false,
      },
      opening: 5 + ((index * 7) % 45),
    })),
  ];

  const SURESH = 3;
  const entries: {
    when: Date;
    item: DbInventoryItem;
    request: RecordMovementRequest;
  }[] = [];
  for (const { item, opening } of seeded) {
    state.items.push(item);
    if (opening !== null) {
      entries.push({
        when: localTime(6, '21:00'),
        item,
        request: { kind: 'COUNT', quantity: opening },
      });
    }
  }
  for (const movement of inventoryFixtures.movements) {
    const item = state.items.find(
      (candidate) => candidate.id === movement.item_id,
    )!;
    entries.push({
      when: localTime(movement.days_ago, movement.time),
      item,
      request: {
        kind: movement.kind as InventoryMovementKind,
        quantity: movement.quantity,
        unit_price: movement.unit_price,
        note: movement.note,
      },
    });
  }
  entries
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .forEach(({ when, item, request }) =>
      bookMovement(state, item, request, when, SURESH),
    );
  return state;
}

function inventoryState(): InventoryState {
  return (db.inventoryState ??= seedInventoryState());
}

type InventoryActor = {
  me: MeResponse;
  admin: boolean;
  managedOutletIds: Set<number>;
};

/** 404 where the business has inventory off; 403 for anyone who is neither admin nor manager. */
function inventoryActor(): InventoryActor {
  const me = resolveMe();
  const business = db.businesses.find(
    (candidate) => candidate.id === me.business.id,
  );
  if (!business?.modules.inventory) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  const admin = canAdminister(me.user.tenant_role);
  const managedOutletIds = new Set(me.memberships.inventory_outlets);
  if (!admin && managedOutletIds.size === 0) {
    throw apiError(403, API_ERROR_CODE.PERMISSION_DENIED, 'Not permitted.');
  }
  return { me, admin, managedOutletIds };
}

function readableInventoryOutlets(actor: InventoryActor): Set<number> {
  return new Set(
    db.outlets
      .filter(
        (outlet) =>
          outlet.tenant_id === actor.me.business.id &&
          !outlet.is_archived &&
          (actor.admin || actor.managedOutletIds.has(outlet.id)),
      )
      .map((outlet) => outlet.id),
  );
}

function readableInventoryOutlet(actor: InventoryActor, outletId: number) {
  if (!readableInventoryOutlets(actor).has(outletId)) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  return outletId;
}

/** ADMIN and OWNER author items and appoint managers; recording stock is the manager's. */
function requireItemAuthor(actor: InventoryActor) {
  if (!actor.admin) {
    throw apiError(
      403,
      API_ERROR_CODE.PERMISSION_DENIED,
      'Only head office can change items.',
    );
  }
}

function toItem({
  tenant_id: _tenant,
  ...item
}: DbInventoryItem): InventoryItem {
  return item;
}

function toMovement({
  tenant_id: _tenant,
  outlet_id: _outlet,
  ...movement
}: DbInventoryMovement): InventoryMovement {
  return movement;
}

/** An item the caller can read, live or archived; anyone else's is a 404. */
function findReadableItem(actor: InventoryActor, id: number): DbInventoryItem {
  const readable = readableInventoryOutlets(actor);
  const item = inventoryState().items.find(
    (candidate) =>
      candidate.id === id &&
      candidate.tenant_id === actor.me.business.id &&
      readable.has(candidate.outlet_id),
  );
  if (!item) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return item;
}

function assertItemNameFree(
  item: Pick<DbInventoryItem, 'tenant_id' | 'outlet_id'>,
  name: string,
  exceptId?: number,
) {
  const taken = inventoryState().items.some(
    (other) =>
      other.tenant_id === item.tenant_id &&
      other.outlet_id === item.outlet_id &&
      other.id !== exceptId &&
      !other.is_archived &&
      other.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    throw invalid(
      'An item with this name already exists at this outlet.',
      'name',
    );
  }
}

function assertValidItemFields(fields: {
  name?: string;
  unit?: InventoryUnit;
  reference_price?: number | null;
}) {
  if (fields.name !== undefined) {
    if (!fields.name.trim()) throw invalid('Name is required.', 'name');
    if (fields.name.trim().length > 150) {
      throw invalid('Use 150 characters or fewer.', 'name');
    }
  }
  if (
    fields.unit !== undefined &&
    !['KG', 'G', 'L', 'ML', 'COUNT'].includes(fields.unit)
  ) {
    throw invalid('Choose a unit.', 'unit');
  }
  if (
    fields.reference_price != null &&
    (!Number.isFinite(fields.reference_price) || fields.reference_price < 0)
  ) {
    throw invalid('Use a price of zero or more.', 'reference_price');
  }
}

/** GET /inventory/items — by name, across the outlets the caller can read. */
export async function mockListInventoryItems(
  query: InventoryItemsQuery,
): Promise<Page<InventoryItem>> {
  await delay();
  const actor = inventoryActor();
  triggerFault(query.search);
  const readable = readableInventoryOutlets(actor);
  const outletId =
    query.outletId === undefined
      ? undefined
      : readableInventoryOutlet(actor, query.outletId);
  const needle = query.search?.trim().toLowerCase();
  const matches = inventoryState()
    .items.filter(
      (item) =>
        item.tenant_id === actor.me.business.id &&
        readable.has(item.outlet_id) &&
        (outletId === undefined || item.outlet_id === outletId) &&
        (query.includeArchived || !item.is_archived) &&
        (!needle || item.name.toLowerCase().includes(needle)),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    .map(toItem);
  return paginate(matches, query.page, query.pageSize);
}

/** POST /inventory/items */
export async function mockCreateInventoryItem(
  request: CreateInventoryItemRequest,
): Promise<InventoryItem> {
  await delay();
  const actor = inventoryActor();
  requireItemAuthor(actor);
  assertValidItemFields(request);
  triggerFault(request.name);
  const outlet = db.outlets.find(
    (candidate) =>
      candidate.id === request.outlet_id &&
      candidate.tenant_id === actor.me.business.id,
  );
  if (!outlet || outlet.is_archived) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  const name = request.name.trim();
  assertItemNameFree(
    { tenant_id: actor.me.business.id, outlet_id: outlet.id },
    name,
  );
  const state = inventoryState();
  const item: DbInventoryItem = {
    id: state.nextItemId++,
    tenant_id: actor.me.business.id,
    outlet_id: outlet.id,
    name,
    unit: request.unit,
    reference_price: request.reference_price ?? null,
    balance: 0,
    is_archived: false,
  };
  state.items.push(item);
  return toItem(item);
}

/** PATCH /inventory/items/{id} — the unit only until movements exist (409 `unit_locked`). */
export async function mockUpdateInventoryItem(
  id: number,
  request: UpdateInventoryItemRequest,
): Promise<InventoryItem> {
  await delay();
  const actor = inventoryActor();
  const item = findReadableItem(actor, id);
  requireItemAuthor(actor);
  assertValidItemFields(request);
  triggerFault(request.name);

  const name = request.name?.trim();
  if (name !== undefined) assertItemNameFree(item, name, item.id);
  if (request.unit !== undefined && request.unit !== item.unit) {
    if (inventoryState().movements.some((m) => m.item_id === item.id)) {
      throw apiError(
        409,
        API_ERROR_CODE.UNIT_LOCKED,
        'The unit cannot change once there are movements.',
        'unit',
      );
    }
    item.unit = request.unit;
  }
  if (name !== undefined) item.name = name;
  if (request.reference_price !== undefined) {
    item.reference_price = request.reference_price;
  }
  if (request.is_archived !== undefined) item.is_archived = request.is_archived;
  return toItem(item);
}

/**
 * GET /inventory/items/{id}/movements, or the same log across an outlet's items
 * (see `InventoryMovementsQuery`). Newest first.
 */
export async function mockListInventoryMovements(
  query: InventoryMovementsQuery,
): Promise<Page<InventoryMovement>> {
  await delay();
  const actor = inventoryActor();
  const { fromMs, toMs } = dayRange(query.from, query.to);
  const readable = readableInventoryOutlets(actor);
  const itemId =
    query.itemId === undefined
      ? undefined
      : findReadableItem(actor, query.itemId).id;
  const outletId =
    query.outletId === undefined
      ? undefined
      : readableInventoryOutlet(actor, query.outletId);
  const matches = inventoryState()
    .movements.filter(
      (movement) =>
        movement.tenant_id === actor.me.business.id &&
        readable.has(movement.outlet_id) &&
        (itemId === undefined || movement.item_id === itemId) &&
        (outletId === undefined || movement.outlet_id === outletId),
    )
    .filter((movement) => {
      const at = new Date(movement.recorded_at).getTime();
      return (fromMs === null || at >= fromMs) && (toMs === null || at <= toMs);
    })
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.id - a.id)
    .map(toMovement);
  return paginate(matches, query.page, query.pageSize);
}

/**
 * POST /inventory/items/{id}/movements — append-only. Recorded by the item's
 * Inventory Manager; an archived item is gone (404).
 */
export async function mockRecordInventoryMovement(
  itemId: number,
  request: RecordMovementRequest,
): Promise<InventoryMovement> {
  await delay();
  const actor = inventoryActor();
  const item = findReadableItem(actor, itemId);
  if (item.is_archived) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  if (!actor.managedOutletIds.has(item.outlet_id)) {
    throw apiError(
      403,
      API_ERROR_CODE.PERMISSION_DENIED,
      'Only this outlet’s Inventory Manager can record movements.',
    );
  }
  if (!['ADD', 'REMOVE', 'COUNT'].includes(request.kind)) {
    throw invalid('Choose add, remove or set actual.', 'kind');
  }
  const { quantity } = request;
  if (!Number.isFinite(quantity))
    throw invalid('Enter a quantity.', 'quantity');
  if (request.kind === 'COUNT' ? quantity < 0 : quantity <= 0) {
    throw invalid(
      request.kind === 'COUNT'
        ? 'A count cannot be below zero.'
        : 'Enter more than zero.',
      'quantity',
    );
  }
  if (item.unit === 'COUNT' && !Number.isInteger(quantity)) {
    throw invalid('Whole numbers only.', 'quantity');
  }
  if (request.unit_price != null) {
    if (request.kind !== 'ADD') {
      throw invalid(
        'A price applies to stock that arrived only.',
        'unit_price',
      );
    }
    if (!Number.isFinite(request.unit_price) || request.unit_price < 0) {
      throw invalid('Use a price of zero or more.', 'unit_price');
    }
  }
  const note = request.note?.trim() || null;
  if (note && note.length > 500)
    throw invalid('Use 500 characters or fewer.', 'note');
  triggerFault(note);

  return toMovement(
    bookMovement(
      inventoryState(),
      item,
      { ...request, note },
      new Date(),
      actor.me.user.id,
    ),
  );
}

/** Reports default to the last seven days, today included. */
function reportRange(query: StockReportQuery) {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const from = query.from ?? localDay(weekAgo);
  const to = query.to ?? localDay(today);
  return { from, to, ...dayRange(from, to) };
}

function reportItems(actor: InventoryActor, outletId: number) {
  readableInventoryOutlet(actor, outletId);
  return inventoryState()
    .items.filter((item) => item.outlet_id === outletId && !item.is_archived)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

/** GET /inventory/reports/stock-on-hand */
export async function mockStockOnHandReport(
  query: Pick<StockReportQuery, 'outletId'>,
): Promise<StockOnHandReport> {
  await delay();
  const actor = inventoryActor();
  return {
    outlet_id: query.outletId,
    as_of: new Date().toISOString(),
    items: reportItems(actor, query.outletId).map((item) => ({
      item_id: item.id,
      name: item.name,
      unit: item.unit,
      balance: item.balance,
    })),
  };
}

/** GET /inventory/reports/summary — opening, in, out and closing over the range. */
export async function mockStockSummaryReport(
  query: StockReportQuery,
): Promise<StockSummaryReport> {
  await delay();
  const actor = inventoryActor();
  const range = reportRange(query);
  const items = reportItems(actor, query.outletId);
  const movements = inventoryState().movements;
  return {
    outlet_id: query.outletId,
    from: range.from,
    to: range.to,
    items: items.map((item) => {
      const own = movements.filter((m) => m.item_id === item.id);
      const at = (m: DbInventoryMovement) => new Date(m.recorded_at).getTime();
      const before = own.filter((m) => at(m) < range.fromMs!);
      const during = own.filter(
        (m) => at(m) >= range.fromMs! && at(m) <= range.toMs!,
      );
      const opening = before.length
        ? before[before.length - 1].balance_after
        : 0;
      const sum = (values: (number | null)[]) =>
        round3(values.reduce<number>((total, v) => total + (v ?? 0), 0));
      return {
        item_id: item.id,
        name: item.name,
        unit: item.unit,
        opening,
        // Stock that arrived unrecorded (a count above the balance) is in "in".
        in: sum(
          during.map((m) => (m.kind === 'ADD' ? m.quantity : m.derived_in)),
        ),
        out: sum(
          during.map((m) => (m.kind === 'REMOVE' ? m.quantity : m.derived_out)),
        ),
        closing: during.length
          ? during[during.length - 1].balance_after
          : opening,
      };
    }),
  };
}

/** GET /inventory/reports/spend — deliveries that carried a price, in rupees. */
export async function mockStockSpendReport(
  query: StockReportQuery,
): Promise<StockSpendReport> {
  await delay();
  const actor = inventoryActor();
  const range = reportRange(query);
  const items = reportItems(actor, query.outletId);
  const movements = inventoryState().movements;
  const rows = items
    .map((item) => {
      const priced = movements.filter(
        (m) =>
          m.item_id === item.id &&
          m.kind === 'ADD' &&
          m.unit_price !== null &&
          new Date(m.recorded_at).getTime() >= range.fromMs! &&
          new Date(m.recorded_at).getTime() <= range.toMs!,
      );
      return {
        item_id: item.id,
        name: item.name,
        unit: item.unit,
        quantity: round3(priced.reduce((total, m) => total + m.quantity, 0)),
        amount: round3(
          priced.reduce((total, m) => total + m.quantity * m.unit_price!, 0),
        ),
      };
    })
    .filter((row) => row.quantity > 0);
  return {
    outlet_id: query.outletId,
    from: range.from,
    to: range.to,
    total: round3(rows.reduce((total, row) => total + row.amount, 0)),
    items: rows,
  };
}

// Inventory Managers. API Contract §12 has no endpoint for appointing them and the
// Schema no membership table (Known Inconsistency #7), so this is the mock's own
// shape, written to the same rows /auth/me reads (`inventory_outlets`).

/** GET (invented) inventory managers of one outlet, by name. */
export async function mockListInventoryManagers(
  outletId: number,
): Promise<InventoryManager[]> {
  await delay();
  const actor = inventoryActor();
  requireItemAuthor(actor);
  readableInventoryOutlet(actor, outletId);
  return db.users
    .filter(
      (user) =>
        user.tenant_id === actor.me.business.id &&
        user.is_active &&
        user.memberships.inventory_outlets.includes(outletId),
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id - b.id)
    .map((user) => ({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
    }));
}

/** Appoint someone as an outlet's Inventory Manager; appointing twice changes nothing. */
export async function mockAppointInventoryManager(
  outletId: number,
  userId: number,
): Promise<void> {
  await delay();
  const actor = inventoryActor();
  requireItemAuthor(actor);
  readableInventoryOutlet(actor, outletId);
  const user = db.users.find(
    (candidate) =>
      candidate.id === userId && candidate.tenant_id === actor.me.business.id,
  );
  if (!user) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  if (!user.is_active) {
    throw invalid('A deactivated user cannot be appointed.', 'user_id');
  }
  if (!user.memberships.inventory_outlets.includes(outletId)) {
    user.memberships.inventory_outlets.push(outletId);
  }
}

/** Take an Inventory Manager off an outlet. Past movements keep their name. */
export async function mockRemoveInventoryManager(
  outletId: number,
  userId: number,
): Promise<void> {
  await delay();
  const actor = inventoryActor();
  requireItemAuthor(actor);
  readableInventoryOutlet(actor, outletId);
  const user = db.users.find(
    (candidate) =>
      candidate.id === userId &&
      candidate.tenant_id === actor.me.business.id &&
      candidate.memberships.inventory_outlets.includes(outletId),
  );
  if (!user) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  user.memberships.inventory_outlets =
    user.memberships.inventory_outlets.filter((id) => id !== outletId);
}

// ---------------------------------------------------------------------------
// Week 9 — spot checks (API Contract §13)
//
// Failure triggers, as in Week 8: a name, prompt, note or image key of "offline"
// kills the network; "fault" is a 500. An override note of "refused" is a 403.
// A run reveals on the mock clock: it is SCHEDULED (no subject) until `revealed_at`,
// OPEN until `window_close`, then settled on the next read: some photographs is
// PARTIAL, none is NOT_DONE (no retry, ever), and every assertion is judged.
// ---------------------------------------------------------------------------

type DbArea = Area & { tenant_id: number };

type DbSpotCheck = SpotCheck & { tenant_id: number };

type DbSpotPhoto = {
  position: number;
  photo: SpotCheckPhoto;
  /** Photos this one replaced on a retake, oldest first. */
  earlier: SpotCheckPhoto[];
};

type DbSpotResult = {
  id: number;
  assertion_position: number;
  assertion_text: string;
  weight: number;
  /** What the assessment decided; shown as PENDING_JUDGEMENT until the run's `ready_at`. */
  outcome: Exclude<SpotCheckOutcome, 'PENDING_JUDGEMENT'>;
  confidence: number;
  overridden_to: SpotCheckResult['overridden_to'];
  override_note: string | null;
  overridden_by_id: number | null;
  overridden_at: string | null;
};

type DbSpotRun = {
  id: number;
  tenant_id: number;
  spot_check_id: number;
  outlet_id: number;
  /** Copied when the run is made: later edits to the check apply from the next one. */
  check_name: string;
  captures: SpotCheckCapture[];
  assertions: { position: number; text: string; weight: number }[];
  subject: { type: SpotCheckSubjectType; id: number };
  manager_id: number;
  scheduled_for: string;
  revealed_at: string;
  window_close: string;
  photos: DbSpotPhoto[];
  settled: boolean;
  completion: SpotCheckCompletion | null;
  results: DbSpotResult[];
  ready_at: string | null;
  issue_id: number | null;
};

type SpotCheckState = {
  areas: DbArea[];
  checks: DbSpotCheck[];
  runs: DbSpotRun[];
  nextAreaId: number;
  nextCheckId: number;
  nextRunId: number;
  nextResultId: number;
};

/** How long a closed run shows "being assessed" before its outcomes appear. */
const SPOT_ASSESS_MS = 2 * MINUTE_MS;
/** Photographs older than this are removed under the retention policy. */
const SPOT_RETENTION_DAYS = 30;
/** How long a send for a `slow` prompt waits before it is answered. */
const SLOW_SEND_MS = 8_000;

const RESHMA = 16;
const ARUN = 17;
/**
 * Signs in as an Administrator on a platform that cannot do several things the
 * mockup has a fallback for (SPT-01 `partialFallback` and `retakeFallback`, SPT-03
 * `afterCloseFallback` and `noIssueLink`, SPT-05 `managerNotWired` and
 * `itemFallback`, SPT-06 `archivedFallback`). Everyone else gets the full platform.
 */
const BASIC = 18;

function onBasicPlatform(actor: SpotActor): boolean {
  return actor.me.user.id === BASIC;
}

const SPOT_OUTCOMES: SpotCheckOutcome[] = ['PASS', 'FAIL', 'NEEDS_REVIEW'];

/** The platform's call, made repeatable: mostly pass, some fail, a few too close to call. */
function judgement(
  runId: number,
  position: number,
): Pick<DbSpotResult, 'outcome' | 'confidence'> {
  const roll = pseudo(runId, position);
  if (roll < 70) {
    return { outcome: 'PASS', confidence: 0.9 + (roll % 10) / 100 };
  }
  if (roll < 82) {
    return { outcome: 'FAIL', confidence: 0.86 + (roll % 10) / 100 };
  }
  // Low confidence is NEEDS_REVIEW and never FAIL (API Contract §13).
  return { outcome: 'NEEDS_REVIEW', confidence: 0.45 + (roll % 20) / 100 };
}

function spotPhoto(
  at: Date,
  managerId: number,
  key: string,
  purged = false,
): SpotCheckPhoto {
  return {
    captured_at: at.toISOString(),
    image_url: purged ? null : `mock://storage/${key}`,
    purged_at: purged ? at.toISOString() : null,
    captured_by: userRef(managerId)!,
  };
}

const LONG_CHECK_NAME = 'Grooming — front of house, evening service';
const LONG_ITEM =
  'the person is wearing the full uniform, a clean apron with the logo showing, closed shoes, and has no jewellery on their hands or wrists';
const LONG_AREA = 'Walk-in cold room, vegetable store and prep';
const MALAYALAM_AREA = 'ശീതീകരിച്ച സംഭരണ മുറി';

function seedSpotCheckState(): SpotCheckState {
  const state: SpotCheckState = {
    areas: [],
    checks: [],
    runs: [],
    nextAreaId: 300,
    nextCheckId: 100,
    nextRunId: 9000,
    nextResultId: 90000,
  };

  for (const area of spotCheckFixtures.areas) {
    state.areas.push({ ...area, tenant_id: 7 });
  }
  // 30 areas at Elegance, so the list runs past a screenful.
  const ELEGANCE_AREAS = [
    'Entrance',
    'Reception',
    'Main hall',
    'Banquet hall',
    'Kitchen',
    'Pastry kitchen',
    'Dishwash',
    'Cold room',
    'Dry store',
    'Staff room',
    'Washroom, ground floor',
    'Washroom, first floor',
    'Bar',
    'Terrace',
    'Lift lobby',
    'Stairs',
    'Waste area',
    'Loading bay',
    'Cash counter',
    'Display counter',
    'Tandoor station',
    'Grill station',
    'Salad station',
    'Beverage station',
    'Packing station',
    'Delivery shelf',
    'Office',
    'offline',
    LONG_AREA,
    MALAYALAM_AREA,
  ];
  ELEGANCE_AREAS.forEach((name, index) =>
    state.areas.push({
      id: 100 + index,
      tenant_id: 7,
      outlet_id: 5,
      name,
      is_eligible: index % 9 !== 8,
      is_archived: false,
    }),
  );

  for (const fixture of spotCheckFixtures.checks) {
    state.checks.push({
      ...fixture,
      tenant_id: 7,
      subject_type: fixture.subject_type as SpotCheckSubjectType,
      recurrence: fixture.recurrence as SpotCheckRecurrence,
      is_archived: false,
      assertions: fixture.assertions.map((assertion) => ({
        ...assertion,
        is_archived: false,
      })),
    });
  }

  // Elegance: 12 checks, so the list is long; the last has 8 prompts and 12 items.
  const filler = (
    id: number,
    name: string,
    prompts: number,
    items: number,
    longItem = false,
  ): DbSpotCheck => ({
    id,
    tenant_id: 7,
    outlet_id: 5,
    name,
    subject_type: id % 2 === 0 ? 'AREA' : 'STAFF',
    recurrence: 'DAILY',
    st_time: `${String(10 + (id % 8)).padStart(2, '0')}:00`,
    weekdays: null,
    day_of_month: null,
    reveal_window_minutes: 15 + (id % 3) * 5,
    is_archived: false,
    captures: Array.from({ length: prompts }, (_, index) => ({
      position: index + 1,
      prompt:
        longItem && index === 0
          ? LONG_ITEM
          : `photograph ${index + 1} of the ${id % 2 === 0 ? 'area' : 'person'}`,
    })),
    assertions: Array.from({ length: items }, (_, index) => ({
      position: index + 1,
      text:
        longItem && index === 0
          ? LONG_ITEM
          : `check item ${index + 1} is as it should be`,
      weight: 3 + (index % 5),
      is_archived: false,
    })),
  });
  state.checks.push(
    filler(11, 'Grooming — front of house', 3, 5),
    ...Array.from({ length: 9 }, (_, index) =>
      filler(12 + index, `Spot check ${index + 1}`, 2, 4),
    ),
    filler(21, LONG_CHECK_NAME, 3, 5, true),
    filler(22, 'Full inspection', 8, 12),
    // Small checks for the photograph states that need a trigger prompt: `upload`
    // (the first upload is refused), `slow` (the send takes 8 seconds) and `revoked`
    // (the role is gone: a 403).
    ...[
      [23, 'Upload test', 'upload'],
      [24, 'Slow send test', 'slow'],
      [25, 'Role lost test', 'revoked'],
    ].map(([id, name, trigger]) => ({
      ...filler(id as number, name as string, 2, 3),
      reveal_window_minutes: 15,
      captures: [
        { position: 1, prompt: trigger as string },
        { position: 2, prompt: 'a second photograph' },
      ],
    })),
  );

  // --- runs ------------------------------------------------------------------

  const at = (minutes: number) => new Date(db.startedAt + minutes * MINUTE_MS);
  const staffAt3 = (name: string) =>
    attendanceState().staff.find(
      (person) =>
        person.full_name === name &&
        person.outlets.some((o) => o.outlet_id === 3),
    )!.id;
  const areaAt3 = (name: string) =>
    state.areas.find((area) => area.outlet_id === 3 && area.name === name)!.id;
  const checkById = (id: number) =>
    state.checks.find((check) => check.id === id)!;

  type RunSeed = {
    id: number;
    check: number;
    subject: number;
    manager: number;
    reveal: Date;
    /** Photographs sent, by prompt position; the rest are not taken. */
    sent?: number[];
    /** Closed runs are settled now; the rest wait for their window. */
    settle?: boolean;
    assessedAt?: Date;
  };
  const makeRun = (seed: RunSeed): DbSpotRun => {
    const check = checkById(seed.check);
    const reveal = seed.reveal;
    const close = new Date(
      reveal.getTime() + check.reveal_window_minutes * MINUTE_MS,
    );
    const live = check.assertions.filter((assertion) => !assertion.is_archived);
    const run: DbSpotRun = {
      id: seed.id,
      tenant_id: 7,
      spot_check_id: check.id,
      outlet_id: check.outlet_id,
      check_name: check.name,
      captures: check.captures.map((capture) => ({ ...capture })),
      assertions: live.map(({ position, text, weight }) => ({
        position,
        text,
        weight,
      })),
      subject: { type: check.subject_type, id: seed.subject },
      manager_id: seed.manager,
      scheduled_for: reveal.toISOString(),
      revealed_at: reveal.toISOString(),
      window_close: close.toISOString(),
      photos: [],
      settled: false,
      completion: null,
      results: [],
      ready_at: null,
      issue_id: null,
    };
    const purged =
      close.getTime() <
      db.startedAt - SPOT_RETENTION_DAYS * 24 * 60 * MINUTE_MS;
    (seed.sent ?? []).forEach((position, index) => {
      run.photos.push({
        position,
        photo: spotPhoto(
          new Date(reveal.getTime() + (2 + index * 3) * MINUTE_MS),
          seed.manager,
          `t7/spot/${run.id}-${position}.jpg`,
          purged,
        ),
        earlier: [],
      });
    });
    if (seed.settle) settleRun(state, run, seed.assessedAt);
    return run;
  };

  const lakshmi = staffAt3('Lakshmi');
  const imran = staffAt3('Imran');
  const rekha = staffAt3('Rekha');
  const joseph = staffAt3('Joseph');
  const dev = staffAt3('Dev');
  const coldRoom = areaAt3('Cold room');
  const kitchen = areaAt3('Kitchen');
  const dishwash = areaAt3('Dishwash');
  const day = (daysAgo: number, hhmm: string) => localTime(daysAgo, hhmm);

  // Today, on the mock clock: one open now with prompt 1 sent, one revealing in
  // minutes (two open at once for a while), one a little later.
  state.runs.push(
    makeRun({
      id: 1,
      check: 1,
      subject: lakshmi,
      manager: RESHMA,
      reveal: at(-5),
      sent: [1],
    }),
    makeRun({
      id: 2,
      check: 2,
      subject: coldRoom,
      manager: RESHMA,
      reveal: at(3),
    }),
    makeRun({
      id: 3,
      check: 3,
      subject: dishwash,
      manager: RESHMA,
      reveal: at(60),
    }),
    // Just closed: all photographs in, outcomes not back yet.
    makeRun({
      id: 6,
      check: 1,
      subject: rekha,
      manager: RESHMA,
      reveal: at(-21),
      sent: [1, 2, 3],
      settle: true,
      assessedAt: at(2),
    }),
    // Yesterday, Cold room, with a review item.
    makeRun({
      id: 4,
      check: 2,
      subject: coldRoom,
      manager: RESHMA,
      reveal: day(1, '16:00'),
      sent: [1, 2],
      settle: true,
    }),
    // Two of three photographs: assessed on these.
    makeRun({
      id: 5,
      check: 1,
      subject: imran,
      manager: RESHMA,
      reveal: day(2, '14:00'),
      sent: [1, 2],
      settle: true,
    }),
    // Nothing sent: not done, and no retry.
    makeRun({
      id: 7,
      check: 1,
      subject: dev,
      manager: RESHMA,
      reveal: day(3, '14:00'),
      settle: true,
    }),
    // A failure overridden, with the time it happened.
    makeRun({
      id: 8,
      check: 1,
      subject: joseph,
      manager: RESHMA,
      reveal: day(4, '14:00'),
      sent: [1, 2, 3],
      settle: true,
    }),
    // An override with no time on it (the platform may not record one).
    makeRun({
      id: 9,
      check: 2,
      subject: kitchen,
      manager: ARUN,
      reveal: day(5, '16:00'),
      sent: [1, 2],
      settle: true,
    }),
    // A retaken photograph: both kept.
    makeRun({
      id: 10,
      check: 1,
      subject: lakshmi,
      manager: RESHMA,
      reveal: day(6, '14:00'),
      sent: [1, 2, 3],
      settle: true,
    }),
    // Another manager's run: outcomes are not Reshma's to see.
    makeRun({
      id: 11,
      check: 2,
      subject: kitchen,
      manager: ARUN,
      reveal: day(1, '16:30'),
      sent: [1, 2],
      settle: true,
    }),
    // Past the retention period: the photographs are gone.
    makeRun({
      id: 12,
      check: 1,
      subject: joseph,
      manager: RESHMA,
      reveal: day(40, '14:00'),
      sent: [1, 2, 3],
      settle: true,
    }),
  );

  const byId = (id: number) => state.runs.find((run) => run.id === id)!;

  // Run 4: the review item.
  const run4 = byId(4);
  run4.results[0] = {
    ...run4.results[0],
    outcome: 'NEEDS_REVIEW',
    confidence: 0.58,
  };
  // Run 8: "name tag is visible" failed, and the manager put it right.
  const run8 = byId(8);
  run8.results[2] = {
    ...run8.results[2],
    outcome: 'FAIL',
    confidence: 0.91,
    overridden_to: 'PASS',
    override_note: 'Tag was pinned under the apron; checked on the floor.',
    overridden_by_id: RESHMA,
    overridden_at: day(4, '15:10').toISOString(),
  };
  // Run 9: Arun's override, without a time.
  const run9 = byId(9);
  run9.results[0] = {
    ...run9.results[0],
    outcome: 'NEEDS_REVIEW',
    confidence: 0.52,
    overridden_to: 'PASS',
    override_note: 'Lower shelf was clear when I looked.',
    overridden_by_id: ARUN,
    overridden_at: null,
  };
  // Run 10: prompt 2 was retaken, the earlier photograph kept.
  const run10 = byId(10);
  const second = run10.photos.find((entry) => entry.position === 2)!;
  second.earlier.push(
    spotPhoto(
      new Date(new Date(second.photo.captured_at).getTime() - 2 * MINUTE_MS),
      RESHMA,
      `t7/spot/${run10.id}-2-first.jpg`,
    ),
  );
  for (const run of [run4, run8, run9]) {
    run.issue_id = hasLiveFail(run) ? 7000 + run.id : null;
  }

  // About thirty more at ZamZam over the last 45 days, and a dozen at Elegance.
  const ZAMZAM_CHECKS = [1, 2, 3];
  for (let index = 0; index < 30; index++) {
    const checkId = ZAMZAM_CHECKS[index % 3];
    const check = checkById(checkId);
    const daysAgo = 7 + index + (index > 22 ? 8 : 0);
    const subject =
      check.subject_type === 'STAFF'
        ? [lakshmi, imran, rekha, joseph, dev][index % 5]
        : [kitchen, coldRoom, dishwash][index % 3];
    const sent = check.captures.map((capture) => capture.position);
    const missed = index % 11 === 6;
    const partial = index % 7 === 3 && sent.length > 1;
    const run = makeRun({
      id: 20 + index,
      check: checkId,
      subject,
      manager: index % 4 === 3 ? ARUN : RESHMA,
      reveal: day(daysAgo, check.st_time),
      sent: missed ? [] : partial ? sent.slice(0, -1) : sent,
      settle: true,
    });
    run.issue_id = hasLiveFail(run) ? 7000 + run.id : null;
    state.runs.push(run);
  }
  const front = checkById(11);
  const frontStaff = attendanceState().staff.filter((person) =>
    person.outlets.some((o) => o.outlet_id === 5),
  );
  for (let index = 0; index < 12; index++) {
    const run = makeRun({
      id: 60 + index,
      check: 11,
      subject: frontStaff[index % frontStaff.length].id,
      manager: ARUN,
      reveal: day(1 + index, front.st_time),
      sent: front.captures.map((capture) => capture.position),
      settle: true,
    });
    run.issue_id = hasLiveFail(run) ? 7000 + run.id : null;
    state.runs.push(run);
  }

  // Two open at Elegance for Arun at the start: the long text, and the eight prompts.
  const kitchen5 = state.areas.find(
    (area) => area.outlet_id === 5 && area.name === 'Kitchen',
  )!;
  state.runs.push(
    makeRun({
      id: 80,
      check: 21,
      subject: frontStaff[0].id,
      manager: ARUN,
      reveal: at(-3),
    }),
    makeRun({
      id: 81,
      check: 22,
      subject: kitchen5.id,
      manager: ARUN,
      reveal: at(-2),
    }),
    // For `uploadFailed` and `pending`: see the trigger prompts on checks 23 and 24.
    makeRun({
      id: 82,
      check: 23,
      subject: frontStaff[1].id,
      manager: ARUN,
      reveal: at(-1),
    }),
    makeRun({
      id: 83,
      check: 24,
      subject: kitchen5.id,
      manager: ARUN,
      reveal: at(-1),
    }),
    makeRun({
      id: 84,
      check: 25,
      subject: frontStaff[2].id,
      manager: ARUN,
      reveal: at(-1),
    }),
    // For the basic platform (sign in as `basic`): its own run to take photographs
    // for, so a partial capture and a retake can be seen the way that platform keeps them.
    makeRun({
      id: 90,
      check: 1,
      subject: dev,
      manager: BASIC,
      reveal: at(-1),
    }),
  );

  return state;
}

function hasLiveFail(run: DbSpotRun): boolean {
  return run.results.some((result) => effectiveOutcome(result) === 'FAIL');
}

/**
 * The window has closed: fix how it ended and judge every assertion against the
 * photographs that were sent. Nothing was sent: not done, and nothing to judge.
 */
function settleRun(state: SpotCheckState, run: DbSpotRun, assessedAt?: Date) {
  if (run.settled) return;
  run.settled = true;
  const sent = run.photos.length;
  run.completion =
    sent === 0 ? 'NOT_DONE' : sent < run.captures.length ? 'PARTIAL' : 'DONE';
  if (run.completion === 'NOT_DONE') return;
  run.results = run.assertions.map((assertion) => ({
    id: state.nextResultId++,
    assertion_position: assertion.position,
    assertion_text: assertion.text,
    weight: assertion.weight,
    ...judgement(run.id, assertion.position),
    overridden_to: null,
    override_note: null,
    overridden_by_id: null,
    overridden_at: null,
  }));
  run.ready_at = (
    assessedAt ??
    new Date(new Date(run.window_close).getTime() + SPOT_ASSESS_MS)
  ).toISOString();
  run.issue_id = hasLiveFail(run) ? 7000 + run.id : null;
}

function spotCheckState(): SpotCheckState {
  return (db.spotCheckState ??= seedSpotCheckState());
}

/** Close every run whose window has passed, as a read of the platform would. */
function settleSpotRuns() {
  const state = spotCheckState();
  const now = Date.now();
  for (const run of state.runs) {
    if (!run.settled && new Date(run.window_close).getTime() <= now) {
      settleRun(state, run);
    }
  }
}

type SpotActor = {
  me: MeResponse;
  admin: boolean;
  managedOutletIds: Set<number>;
};

/** 404 where no outlet has spot checks on; 403 for anyone who is neither admin nor manager. */
function spotActor(): SpotActor {
  const me = resolveMe();
  if (me.modules.spot_check_outlets.length === 0) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  const admin = canAdminister(me.user.tenant_role);
  const managedOutletIds = new Set(
    me.memberships.spot_check_outlets.filter((id) =>
      me.modules.spot_check_outlets.includes(id),
    ),
  );
  if (!admin && managedOutletIds.size === 0) {
    throw apiError(403, API_ERROR_CODE.PERMISSION_DENIED, 'Not permitted.');
  }
  return { me, admin, managedOutletIds };
}

/** Outlets with spot checks on that the caller may read; anything else looks the same: 404. */
function readableSpotOutlets(actor: SpotActor): Set<number> {
  return new Set(
    actor.admin
      ? actor.me.modules.spot_check_outlets
      : [...actor.managedOutletIds],
  );
}

function readableSpotOutlet(actor: SpotActor, outletId: number) {
  if (!readableSpotOutlets(actor).has(outletId)) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  return outletId;
}

/** ADMIN and OWNER author checks and areas and appoint managers. */
function requireSpotAuthor(actor: SpotActor) {
  if (!actor.admin) {
    throw apiError(
      403,
      API_ERROR_CODE.PERMISSION_DENIED,
      'Only head office can change spot checks.',
    );
  }
}

function toArea({ tenant_id: _tenant, ...area }: DbArea): Area {
  return area;
}

function findSpotArea(actor: SpotActor, id: number): DbArea {
  const readable = readableSpotOutlets(actor);
  const area = spotCheckState().areas.find(
    (candidate) =>
      candidate.id === id &&
      candidate.tenant_id === actor.me.business.id &&
      readable.has(candidate.outlet_id),
  );
  if (!area) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return area;
}

function assertAreaName(name: string) {
  if (!name.trim()) throw invalid('Name is required.', 'name');
  if (name.trim().length > 150) {
    throw invalid('Use 150 characters or fewer.', 'name');
  }
}

/** Schema: `unique(outlet_id, name)`, archived areas included. */
function assertAreaNameFree(area: DbArea, name: string, exceptId?: number) {
  const taken = spotCheckState().areas.some(
    (other) =>
      other.outlet_id === area.outlet_id &&
      other.id !== exceptId &&
      other.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (taken) {
    throw invalid(
      'An area with this name already exists at this outlet.',
      'name',
    );
  }
}

/** GET areas — by name, with archived ones on request. Mock only. */
export async function mockListAreas(query: AreasQuery): Promise<Page<Area>> {
  await delay();
  const actor = spotActor();
  if (query.includeArchived && onBasicPlatform(actor)) {
    throw apiError(
      400,
      'archived_not_listed',
      'Archived areas cannot be listed.',
      'include_archived',
    );
  }
  const readable = readableSpotOutlets(actor);
  const outletId =
    query.outletId === undefined
      ? undefined
      : readableSpotOutlet(actor, query.outletId);
  const matches = spotCheckState()
    .areas.filter(
      (area) =>
        area.tenant_id === actor.me.business.id &&
        readable.has(area.outlet_id) &&
        (outletId === undefined || area.outlet_id === outletId) &&
        (query.includeArchived || !area.is_archived),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    .map(toArea);
  return paginate(matches, query.page, query.pageSize);
}

/** POST an area. Mock only. */
export async function mockCreateArea(
  request: CreateAreaRequest,
): Promise<Area> {
  await delay();
  const actor = spotActor();
  requireSpotAuthor(actor);
  triggerFault(request.name);
  triggerRevoked(request.name);
  const outletId = readableSpotOutlet(actor, request.outlet_id);
  assertAreaName(request.name);
  const state = spotCheckState();
  const area: DbArea = {
    id: state.nextAreaId++,
    tenant_id: actor.me.business.id,
    outlet_id: outletId,
    name: request.name.trim(),
    is_eligible: request.is_eligible ?? true,
    is_archived: false,
  };
  assertAreaNameFree(area, area.name);
  state.areas.push(area);
  return toArea(area);
}

/** PATCH an area: rename, switch eligibility, archive or restore. An archived area is frozen. Mock only. */
export async function mockUpdateArea(
  id: number,
  request: UpdateAreaRequest,
): Promise<Area> {
  await delay();
  const actor = spotActor();
  requireSpotAuthor(actor);
  const area = findSpotArea(actor, id);
  // An area called "offline" or "fault" fails whatever is changed on it, so the
  // switch and the sheet can be seen failing (SPT-06 `switchFailed`).
  triggerFault(area.name);
  triggerFault(request.name);
  triggerRevoked(area.name);
  triggerRevoked(request.name);
  if (
    area.is_archived &&
    (request.is_archived === undefined || request.is_archived)
  ) {
    throw invalid('An archived area cannot be changed.', 'is_archived');
  }
  if (request.name !== undefined) {
    assertAreaName(request.name);
    assertAreaNameFree(area, request.name, area.id);
    area.name = request.name.trim();
  }
  if (request.is_eligible !== undefined) area.is_eligible = request.is_eligible;
  if (request.is_archived !== undefined) area.is_archived = request.is_archived;
  return toArea(area);
}

// checks

function toCheck({ tenant_id: _tenant, ...check }: DbSpotCheck): SpotCheck {
  return check;
}

function findSpotCheck(actor: SpotActor, id: number): DbSpotCheck {
  const readable = readableSpotOutlets(actor);
  const check = spotCheckState().checks.find(
    (candidate) =>
      candidate.id === id &&
      candidate.tenant_id === actor.me.business.id &&
      readable.has(candidate.outlet_id),
  );
  if (!check) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return check;
}

/** An archived check is frozen: no edit, no new prompts or items. */
function findEditableSpotCheck(actor: SpotActor, id: number): DbSpotCheck {
  requireSpotAuthor(actor);
  const check = findSpotCheck(actor, id);
  if (check.is_archived) {
    throw invalid('An archived spot check cannot be changed.', 'is_archived');
  }
  return check;
}

function assertValidSpotCheck(
  fields: Pick<
    SpotCheck,
    | 'name'
    | 'subject_type'
    | 'recurrence'
    | 'st_time'
    | 'weekdays'
    | 'day_of_month'
    | 'reveal_window_minutes'
  >,
) {
  if (fields.name.trim().length > 150) {
    throw invalid('Use 150 characters or fewer.', 'name');
  }
  if (!['STAFF', 'AREA'].includes(fields.subject_type)) {
    throw invalid('Choose staff or area.', 'subject_type');
  }
  if ((fields.recurrence as string) === 'HOURLY') {
    throw invalid('A spot check cannot repeat hourly.', 'recurrence');
  }
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(fields.recurrence)) {
    throw invalid('Choose daily, weekly or monthly.', 'recurrence');
  }
  if (
    !Number.isInteger(fields.reveal_window_minutes) ||
    fields.reveal_window_minutes < 15 ||
    fields.reveal_window_minutes > 30
  ) {
    throw invalid('Use between 15 and 30 minutes.', 'reveal_window_minutes');
  }
  assertValidSchedule({
    name: fields.name,
    recurrence: fields.recurrence,
    st_time: fields.st_time,
    deadline_minutes: fields.reveal_window_minutes,
    weekdays: fields.weekdays,
    day_of_month: fields.day_of_month,
    interval_hours: null,
    last_run_time: null,
  });
}

/**
 * Prompts and items written together, in order (mock only). Checked in full before
 * anything is changed, so a refused save leaves the check as it was.
 */
function checkedLists(lists: SpotCheckLists) {
  const out: {
    captures?: SpotCheckCapture[];
    assertions?: SpotCheckAssertion[];
  } = {};
  if (lists.captures !== undefined) {
    if (lists.captures.length === 0) {
      throw invalid('A spot check needs at least one prompt.', 'captures');
    }
    out.captures = lists.captures.map((capture, index) => {
      const prompt = capture.prompt.trim();
      if (!prompt) throw invalid('Prompt is required.', 'captures');
      if (prompt.length > 200) {
        throw invalid('Use 200 characters or fewer.', 'captures');
      }
      return { position: index + 1, prompt };
    });
  }
  if (lists.assertions !== undefined) {
    out.assertions = lists.assertions.map((item, index) => {
      assertValidItem({ text: item.text, weight: item.weight });
      return {
        position: index + 1,
        text: item.text.trim(),
        weight: item.weight,
        is_archived: item.is_archived,
      };
    });
  }
  return out;
}

/** GET /spot-checks — by name, across the outlets the caller can read. */
export async function mockListSpotChecks(
  query: SpotChecksQuery,
): Promise<Page<SpotCheck>> {
  await delay();
  const actor = spotActor();
  const readable = readableSpotOutlets(actor);
  const outletId =
    query.outletId === undefined
      ? undefined
      : readableSpotOutlet(actor, query.outletId);
  const matches = spotCheckState()
    .checks.filter(
      (check) =>
        check.tenant_id === actor.me.business.id &&
        readable.has(check.outlet_id) &&
        (outletId === undefined || check.outlet_id === outletId) &&
        (query.includeArchived || !check.is_archived),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    .map(toCheck);
  return paginate(matches, query.page, query.pageSize);
}

/** GET /spot-checks/{id} — with its prompts and items. */
export async function mockGetSpotCheck(id: number): Promise<SpotCheck> {
  await delay();
  const actor = spotActor();
  return toCheck(findSpotCheck(actor, id));
}

/** POST /spot-checks */
export async function mockCreateSpotCheck(
  request: CreateSpotCheckRequest,
): Promise<SpotCheck> {
  await delay();
  const actor = spotActor();
  requireSpotAuthor(actor);
  triggerFault(request.name);
  triggerRevoked(request.name);
  const outletId = readableSpotOutlet(actor, request.outlet_id);
  assertValidSpotCheck(request);
  const lists = checkedLists(request);
  const state = spotCheckState();
  const { captures: _captures, assertions: _assertions, ...fields } = request;
  const check: DbSpotCheck = {
    ...fields,
    id: state.nextCheckId++,
    tenant_id: actor.me.business.id,
    outlet_id: outletId,
    name: request.name.trim(),
    is_archived: false,
    captures: lists.captures ?? [],
    assertions: lists.assertions ?? [],
  };
  state.checks.push(check);
  return toCheck(check);
}

/** PATCH /spot-checks/{id} — everything but the outlet. Runs already made keep their prompts and items. */
export async function mockUpdateSpotCheck(
  id: number,
  request: UpdateSpotCheckRequest,
): Promise<SpotCheck> {
  await delay();
  const actor = spotActor();
  requireSpotAuthor(actor);
  const check = findSpotCheck(actor, id);
  triggerFault(request.name);
  triggerRevoked(check.name);
  triggerRevoked(request.name);
  // A platform that cannot change the list of a check that exists (SPT-05 `itemFallback`).
  if (
    onBasicPlatform(actor) &&
    (request.captures !== undefined || request.assertions !== undefined)
  ) {
    throw apiError(
      400,
      'list_locked',
      'The prompts and items of a check cannot be changed.',
      'captures',
    );
  }
  if (check.is_archived && request.is_archived !== false) {
    throw invalid('An archived spot check cannot be changed.', 'is_archived');
  }
  const next = {
    name: request.name?.trim() ?? check.name,
    subject_type: request.subject_type ?? check.subject_type,
    recurrence: request.recurrence ?? check.recurrence,
    st_time: request.st_time ?? check.st_time,
    weekdays:
      request.weekdays === undefined ? check.weekdays : request.weekdays,
    day_of_month:
      request.day_of_month === undefined
        ? check.day_of_month
        : request.day_of_month,
    reveal_window_minutes:
      request.reveal_window_minutes ?? check.reveal_window_minutes,
  };
  assertValidSpotCheck(next);
  const lists = checkedLists(request);
  Object.assign(check, next);
  if (lists.captures) check.captures = lists.captures;
  if (lists.assertions) check.assertions = lists.assertions;
  if (request.is_archived !== undefined)
    check.is_archived = request.is_archived;
  return toCheck(check);
}

/** POST /spot-checks/{id}/captures — added at the end. */
export async function mockAddSpotCheckCapture(
  id: number,
  request: SpotCheckCaptureRequest,
): Promise<SpotCheckCapture> {
  await delay();
  const actor = spotActor();
  const check = findEditableSpotCheck(actor, id);
  triggerFault(request.prompt);
  if (!request.prompt.trim()) throw invalid('Prompt is required.', 'prompt');
  if (request.prompt.trim().length > 200) {
    throw invalid('Use 200 characters or fewer.', 'prompt');
  }
  const capture = {
    position: check.captures.length + 1,
    prompt: request.prompt.trim(),
  };
  check.captures.push(capture);
  return capture;
}

/** PATCH a prompt's wording. Mock only: the contract lists add and read. */
export async function mockUpdateSpotCheckCapture(
  id: number,
  position: number,
  request: SpotCheckCaptureRequest,
): Promise<SpotCheckCapture> {
  await delay();
  const actor = spotActor();
  const check = findEditableSpotCheck(actor, id);
  triggerFault(request.prompt);
  const capture = check.captures.find((entry) => entry.position === position);
  if (!capture) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  if (!request.prompt.trim()) throw invalid('Prompt is required.', 'prompt');
  capture.prompt = request.prompt.trim();
  return capture;
}

/** DELETE a prompt; those after it move up. Mock only. */
export async function mockRemoveSpotCheckCapture(
  id: number,
  position: number,
): Promise<void> {
  await delay();
  const actor = spotActor();
  const check = findEditableSpotCheck(actor, id);
  if (!check.captures.some((entry) => entry.position === position)) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  check.captures = check.captures
    .filter((entry) => entry.position !== position)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

function assertValidItem(fields: { text?: string; weight?: number }) {
  if (fields.text !== undefined) {
    if (!fields.text.trim()) throw invalid('Text is required.', 'text');
    if (fields.text.trim().length > 200) {
      throw invalid('Use 200 characters or fewer.', 'text');
    }
  }
  if (
    fields.weight !== undefined &&
    (!Number.isInteger(fields.weight) ||
      fields.weight < 1 ||
      fields.weight > 10)
  ) {
    throw invalid('Use a weight from 1 to 10.', 'weight');
  }
}

/** POST /spot-checks/{id}/assertions — added at the end, never tied to a prompt. */
export async function mockAddSpotCheckAssertion(
  id: number,
  request: SpotCheckAssertionRequest,
): Promise<SpotCheckAssertion> {
  await delay();
  const actor = spotActor();
  const check = findEditableSpotCheck(actor, id);
  triggerFault(request.text);
  if (request.text === undefined) throw invalid('Text is required.', 'text');
  assertValidItem(request);
  const assertion: SpotCheckAssertion = {
    position: check.assertions.length + 1,
    text: request.text.trim(),
    weight: request.weight ?? DEFAULT_WEIGHT,
    is_archived: false,
  };
  check.assertions.push(assertion);
  return assertion;
}

/** PATCH an item: wording, weight, archive or restore. Mock only. */
export async function mockUpdateSpotCheckAssertion(
  id: number,
  position: number,
  request: SpotCheckAssertionRequest,
): Promise<SpotCheckAssertion> {
  await delay();
  const actor = spotActor();
  const check = findEditableSpotCheck(actor, id);
  triggerFault(request.text);
  const assertion = check.assertions.find(
    (entry) => entry.position === position,
  );
  if (!assertion) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  assertValidItem(request);
  if (request.text !== undefined) assertion.text = request.text.trim();
  if (request.weight !== undefined) assertion.weight = request.weight;
  if (request.is_archived !== undefined) {
    assertion.is_archived = request.is_archived;
  }
  return assertion;
}

// Spot-check Managers. The Schema has no membership table (Known Inconsistency
// #7), so this is the mock's own shape, written to the rows /auth/me reads
// (`spot_check_outlets`).

/** GET (invented) spot-check managers of one outlet, by name. */
export async function mockListSpotCheckManagers(
  outletId: number,
): Promise<SpotCheckManager[]> {
  await delay();
  const actor = spotActor();
  if (onBasicPlatform(actor)) {
    throw apiError(
      405,
      'method_not_allowed',
      'Spot-check managers cannot be changed here.',
    );
  }
  requireSpotAuthor(actor);
  readableSpotOutlet(actor, outletId);
  return db.users
    .filter(
      (user) =>
        user.tenant_id === actor.me.business.id &&
        user.is_active &&
        user.memberships.spot_check_outlets.includes(outletId),
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id - b.id)
    .map((user) => ({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
    }));
}

/** Appoint someone as an outlet's Spot-check Manager; appointing twice changes nothing. */
export async function mockAppointSpotCheckManager(
  outletId: number,
  userId: number,
): Promise<void> {
  await delay();
  const actor = spotActor();
  if (onBasicPlatform(actor)) {
    throw apiError(
      405,
      'method_not_allowed',
      'Spot-check managers cannot be changed here.',
    );
  }
  requireSpotAuthor(actor);
  readableSpotOutlet(actor, outletId);
  const user = db.users.find(
    (candidate) =>
      candidate.id === userId && candidate.tenant_id === actor.me.business.id,
  );
  if (!user) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  if (!user.is_active) {
    throw invalid('A deactivated user cannot be appointed.', 'user_id');
  }
  if (!user.memberships.spot_check_outlets.includes(outletId)) {
    user.memberships.spot_check_outlets.push(outletId);
  }
}

/** Take a Spot-check Manager off an outlet. Their past runs keep their name. */
export async function mockRemoveSpotCheckManager(
  outletId: number,
  userId: number,
): Promise<void> {
  await delay();
  const actor = spotActor();
  if (onBasicPlatform(actor)) {
    throw apiError(
      405,
      'method_not_allowed',
      'Spot-check managers cannot be changed here.',
    );
  }
  requireSpotAuthor(actor);
  readableSpotOutlet(actor, outletId);
  const user = db.users.find(
    (candidate) =>
      candidate.id === userId &&
      candidate.tenant_id === actor.me.business.id &&
      candidate.memberships.spot_check_outlets.includes(outletId),
  );
  if (!user) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  user.memberships.spot_check_outlets =
    user.memberships.spot_check_outlets.filter((id) => id !== outletId);
}

// runs, photographs and results

function runStatus(run: DbSpotRun, now: number): SpotCheckRunStatus {
  if (now < new Date(run.revealed_at).getTime()) return 'SCHEDULED';
  return now < new Date(run.window_close).getTime() ? 'OPEN' : 'FINALIZED';
}

function toRunPhoto(photo: SpotCheckPhoto): SpotCheckPhoto {
  return { ...photo, captured_by: { ...photo.captured_by } };
}

function toResult(
  run: DbSpotRun,
  result: DbSpotResult,
  now: number,
): SpotCheckResult {
  const pending =
    run.ready_at !== null && now < new Date(run.ready_at).getTime();
  return {
    id: result.id,
    assertion_position: result.assertion_position,
    assertion_text: result.assertion_text,
    outcome: pending ? 'PENDING_JUDGEMENT' : result.outcome,
    confidence: pending ? null : result.confidence,
    overridden_to: result.overridden_to,
    override_note: result.override_note,
    overridden_by: userRef(result.overridden_by_id),
    overridden_at: result.overridden_at,
  };
}

/**
 * 🔒 Before the reveal nothing identifies the subject: no name, no id, no times.
 * Outcomes are the responsible manager's and head office's; another manager sees none.
 */
function toRun(actor: SpotActor, run: DbSpotRun): SpotCheckRun {
  const now = Date.now();
  const status = runStatus(run, now);
  const base = {
    id: run.id,
    spot_check_id: run.spot_check_id,
    spot_check_name: run.check_name,
    outlet_id: run.outlet_id,
    status,
    manager: userRef(run.manager_id),
  };
  if (status === 'SCHEDULED') {
    return {
      ...base,
      // 🔒 No subject, and no time that gives the moment of the reveal away.
      scheduled_for: null,
      subject: null,
      revealed_at: null,
      window_close: null,
      captures: null,
      completion: null,
      results: null,
      issue_id: null,
    };
  }
  const state = spotCheckState();
  let subject: SpotCheckRun['subject'];
  if (run.subject.type === 'STAFF') {
    const person = attendanceState().staff.find(
      (candidate) => candidate.id === run.subject.id,
    );
    subject = {
      type: 'STAFF',
      id: run.subject.id,
      full_name: person?.full_name ?? '',
    };
  } else {
    const area = state.areas.find(
      (candidate) => candidate.id === run.subject.id,
    );
    subject = { type: 'AREA', id: run.subject.id, name: area?.name ?? '' };
  }
  const sees = actor.admin || run.manager_id === actor.me.user.id;
  const basic = onBasicPlatform(actor);
  // On the basic platform a partial capture is simply "not done" and is not assessed,
  // a retake overwrites, and no failure raises an issue.
  const completion =
    status === 'FINALIZED'
      ? basic && run.completion === 'PARTIAL'
        ? 'NOT_DONE'
        : run.completion
      : null;
  return {
    ...base,
    scheduled_for: run.scheduled_for,
    subject,
    revealed_at: run.revealed_at,
    window_close: run.window_close,
    captures: run.captures.map((capture) => {
      const sent = run.photos.find(
        (entry) => entry.position === capture.position,
      );
      return {
        ...capture,
        photo: sent ? toRunPhoto(sent.photo) : null,
        earlier_photos: sent && !basic ? sent.earlier.map(toRunPhoto) : [],
      };
    }),
    completion,
    results:
      sees && status === 'FINALIZED'
        ? basic && run.completion === 'PARTIAL'
          ? []
          : run.results.map((result) => toResult(run, result, now))
        : null,
    issue_id: sees && !basic ? run.issue_id : null,
  };
}

/** A run of an outlet the caller can read; the capture flow is the responsible manager's. */
function findSpotRun(actor: SpotActor, id: number): DbSpotRun {
  settleSpotRuns();
  const readable = readableSpotOutlets(actor);
  const run = spotCheckState().runs.find(
    (candidate) =>
      candidate.id === id &&
      candidate.tenant_id === actor.me.business.id &&
      readable.has(candidate.outlet_id),
  );
  if (!run) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  return run;
}

/** Whether the caller can see this run's outcomes yet: theirs, or head office, once assessed. */
function outcomesVisible(actor: SpotActor, run: DbSpotRun, now: number) {
  return (
    (actor.admin || run.manager_id === actor.me.user.id) &&
    (run.ready_at === null || now >= new Date(run.ready_at).getTime())
  );
}

/** A result still waiting on a person: needs review and not yet overridden. */
function needsReview(actor: SpotActor, run: DbSpotRun, now: number): boolean {
  return (
    outcomesVisible(actor, run, now) &&
    run.results.some(
      (result) =>
        result.outcome === 'NEEDS_REVIEW' && result.overridden_to === null,
    )
  );
}

/**
 * GET /spot-check-runs. `revealed` and `scheduled` are the responsible manager's own;
 * `closed` is the results list (mock only): runs that need review first, then newest.
 */
export async function mockListSpotCheckRuns(
  query: SpotCheckRunsQuery,
): Promise<Page<SpotCheckRun>> {
  await delay();
  const actor = spotActor();
  settleSpotRuns();
  const readable = readableSpotOutlets(actor);
  const outletId =
    query.outletId === undefined
      ? undefined
      : readableSpotOutlet(actor, query.outletId);
  const now = Date.now();
  const wanted: SpotCheckRunStatus | null =
    query.state === 'revealed'
      ? 'OPEN'
      : query.state === 'scheduled'
        ? 'SCHEDULED'
        : query.state === 'closed'
          ? 'FINALIZED'
          : null;
  const matches = spotCheckState()
    .runs.filter((run) => {
      if (run.tenant_id !== actor.me.business.id) return false;
      if (!readable.has(run.outlet_id)) return false;
      if (outletId !== undefined && run.outlet_id !== outletId) return false;
      const status = runStatus(run, now);
      if (wanted && status !== wanted) return false;
      if (
        (wanted === 'OPEN' || wanted === 'SCHEDULED') &&
        !actor.admin &&
        run.manager_id !== actor.me.user.id
      ) {
        return false;
      }
      if (
        query.outcome &&
        !(
          outcomesVisible(actor, run, now) &&
          // By what each result stands as now (an override counts), as the cards' tally does.
          run.results.some(
            (result) => effectiveOutcome(result) === query.outcome,
          )
        )
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const time = (iso: string) => new Date(iso).getTime();
      if (wanted === 'SCHEDULED')
        return time(a.revealed_at) - time(b.revealed_at);
      // Soonest to close first, so the one running out of time leads.
      if (wanted === 'OPEN') return time(a.window_close) - time(b.window_close);
      if (wanted === 'FINALIZED') {
        const review =
          Number(needsReview(actor, b, now)) -
          Number(needsReview(actor, a, now));
        if (review !== 0) return review;
      }
      return time(b.window_close) - time(a.window_close);
    })
    .map((run) => toRun(actor, run));
  return paginate(matches, query.page, query.pageSize);
}

/** GET /spot-check-runs/{id} */
export async function mockGetSpotCheckRun(id: number): Promise<SpotCheckRun> {
  await delay();
  const actor = spotActor();
  const run = findSpotRun(actor, id);
  // 🔒 An open check was revealed to its own manager and head office: to another
  // manager at the outlet it does not exist, the same as the lists leave it out.
  if (
    !actor.admin &&
    run.manager_id !== actor.me.user.id &&
    runStatus(run, Date.now()) === 'OPEN'
  ) {
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  }
  return toRun(actor, run);
}

/**
 * POST /spot-check-runs/{id}/photos — the responsible manager only. A photograph
 * for a prompt that already has one replaces it, and the earlier one is kept.
 */
export async function mockSubmitSpotCheckPhoto(
  id: number,
  request: SubmitSpotCheckPhotoRequest,
): Promise<SpotCheckRun> {
  await delay();
  const actor = spotActor();
  triggerFault(request.image_key);
  const run = findSpotRun(actor, id);
  if (run.manager_id !== actor.me.user.id) {
    throw apiError(
      403,
      API_ERROR_CODE.NOT_YOUR_ASSIGNMENT,
      'This check was revealed to someone else.',
    );
  }
  // A prompt of `slow`: the send takes a while to be answered, so the prompt can
  // be seen as "Waiting to send" (SPT-01 `pending`), and a lost signal leaves it queued.
  const asked = run.captures.find(
    (capture) => capture.position === request.capture_position,
  );
  // A prompt of `revoked`: the role was taken away, so the photograph is refused (403).
  if (asked) triggerRevoked(asked.prompt);
  if (asked && isPromptTrigger(asked.prompt, 'slow')) {
    await new Promise((resolve) => setTimeout(resolve, SLOW_SEND_MS));
  }
  const now = Date.now();
  if (now < new Date(run.revealed_at).getTime()) {
    throw apiError(
      409,
      API_ERROR_CODE.WINDOW_NOT_OPEN,
      'This check has not opened.',
    );
  }
  if (now >= new Date(run.window_close).getTime()) {
    throw apiError(409, API_ERROR_CODE.WINDOW_CLOSED, 'This check has closed.');
  }
  if (
    !run.captures.some(
      (capture) => capture.position === request.capture_position,
    )
  ) {
    throw invalid('There is no such prompt.', 'capture_position');
  }
  if (!request.image_key.trim())
    throw invalid('Image is required.', 'image_key');
  const photo = spotPhoto(new Date(now), run.manager_id, request.image_key);
  const sent = run.photos.find(
    (entry) => entry.position === request.capture_position,
  );
  if (sent) {
    // A platform that keeps only the latest photograph (SPT-01 `retakeFallback`).
    if (!onBasicPlatform(actor)) sent.earlier.push(sent.photo);
    sent.photo = photo;
  } else {
    run.photos.push({ position: request.capture_position, photo, earlier: [] });
  }
  return toRun(actor, run);
}

/**
 * PATCH /spot-check-results/{id} — the note is required, and the original outcome is
 * kept beside the override. The responsible manager and head office may override.
 */
export async function mockOverrideSpotCheckResult(
  id: number,
  request: OverrideSpotCheckResultRequest,
): Promise<SpotCheckResult> {
  await delay();
  const actor = spotActor();
  settleSpotRuns();
  triggerFault(request.override_note);
  const readable = readableSpotOutlets(actor);
  const run = spotCheckState().runs.find(
    (candidate) =>
      candidate.tenant_id === actor.me.business.id &&
      readable.has(candidate.outlet_id) &&
      candidate.results.some((result) => result.id === id),
  );
  const result = run?.results.find((entry) => entry.id === id);
  if (!run || !result)
    throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  if (
    request.override_note.trim().toLowerCase() === 'refused' ||
    (!actor.admin && run.manager_id !== actor.me.user.id)
  ) {
    throw apiError(
      403,
      API_ERROR_CODE.PERMISSION_DENIED,
      "You can't change this result.",
    );
  }
  // A platform that takes no override once the window has closed (SPT-03
  // `afterCloseFallback`); results only exist after the close, so none is allowed.
  if (onBasicPlatform(actor)) {
    throw apiError(
      409,
      API_ERROR_CODE.WINDOW_CLOSED,
      "Results can't be changed after the window closes.",
    );
  }
  if (!request.override_note.trim()) {
    throw apiError(
      400,
      API_ERROR_CODE.OVERRIDE_NOTE_REQUIRED,
      'Say why you are changing this result.',
      'override_note',
    );
  }
  if (!SPOT_OUTCOMES.includes(request.overridden_to)) {
    throw invalid('Choose passed, failed or needs review.', 'overridden_to');
  }
  const now = Date.now();
  if (run.ready_at !== null && now < new Date(run.ready_at).getTime()) {
    throw invalid('This result is still being assessed.', 'overridden_to');
  }
  result.overridden_to = request.overridden_to;
  result.override_note = request.override_note.trim();
  result.overridden_by_id = actor.me.user.id;
  result.overridden_at = new Date(now).toISOString();
  run.issue_id = hasLiveFail(run) ? 7000 + run.id : run.issue_id;
  return toResult(run, result, now);
}
