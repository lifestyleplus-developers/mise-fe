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
import type {
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
import {
  HOURLY_INTERVALS,
  MIN_WINDOW_MINUTES,
  isRunTime,
  windowOverlapsNextRun,
} from '@/shared/lib/schedule';
import { ApiError } from '@/shared/api/http';

import attendanceFixtures from './fixtures/attendance.json';
import businesses from './fixtures/businesses.json';
import checklistFixtures from './fixtures/checklists.json';
import inventoryFixtures from './fixtures/inventory.json';
import outletFixtures from './fixtures/outlets.json';
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
      weight: 5,
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
        weight: 5,
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
    weight: request.weight ?? 5,
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

/**
 * POST /uploads/sign — §8. Returns a location the client PUTs to. The mock
 * cannot accept real bytes; the key is recorded so the PATCH that follows
 * the upload carries it.
 */
export async function mockSignUpload(
  request: UploadSignRequest,
): Promise<UploadSignResponse> {
  await delay();
  const me = resolveMe();
  const key = `t${me.business.id}/mock/${request.target_id}-${Date.now()}.jpg`;
  db.signedUploadKeys.set(request.target_id, key);
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

function assertCodeFree(
  tenantId: number,
  code: string | null | undefined,
  exceptId?: number,
) {
  if (!code) return;
  const taken = attendanceState().staff.some(
    (person) =>
      person.tenant_id === tenantId &&
      person.id !== exceptId &&
      person.staff_code?.toLowerCase() === code.toLowerCase(),
  );
  if (taken) {
    throw invalid('That code is already used by someone else.', 'staff_code');
  }
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
  assertCodeFree(actor.me.business.id, code);

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
  assertCodeFree(actor.me.business.id, code, person.id);

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

/** §11 and §5: the schedule's shape, the window against the next period, and the name. */
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
  outletId: number,
  tenantId: number,
  exceptId?: number,
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

  const taken = attendanceState().configs.some(
    (other) =>
      other.tenant_id === tenantId &&
      other.outlet_id === outletId &&
      other.id !== exceptId &&
      !other.is_archived &&
      other.name.toLowerCase() === config.name.trim().toLowerCase(),
  );
  if (taken) {
    throw invalid(
      'This name is already used for another session at this outlet.',
      'name',
    );
  }
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
  assertValidConfig(schedule, request.outlet_id, actor.me.business.id);

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
  assertValidConfig(next, config.outlet_id, config.tenant_id, config.id);
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
