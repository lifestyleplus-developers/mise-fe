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

import businesses from './fixtures/businesses.json';
import checklistFixtures from './fixtures/checklists.json';
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
  judgements?: Map<
    number,
    { readyAt: number; verdict: 'PASS' | 'FAIL'; comment: string }
  >;
  /** Authored checklists, tasks and assignments; seeded on first use. */
  checklistState?: ChecklistState;
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
  | { status: 409; body: ApiErrorBody & AmbiguousUsernameBody }
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
        },
        businesses: matches.map((user) => {
          const business = db.businesses.find((b) => b.id === user.tenant_id);
          return { id: business?.id ?? 0, name: business?.name ?? '' };
        }),
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

const JUDGE_COMMENTS = {
  PASS: [
    'The photo is clear and shows what the task asks for.',
    'Everything the task asks about is in frame and easy to see.',
    'The subject is well lit and nothing important is hidden.',
  ],
  FAIL: [
    'The photo is too dark to make out what is shown.',
    'Part of what the task asks about is cut off at the edge of the frame.',
    'What is in the photo does not match what the task asks for.',
  ],
};

/** A photo was just submitted: pick its verdict now, show it after a short wait. */
function startJudgement(taskId: number): void {
  db.judgements ??= new Map();
  const verdict = Math.random() < JUDGE_PASS_CHANCE ? 'PASS' : 'FAIL';
  const comments = JUDGE_COMMENTS[verdict];
  db.judgements.set(taskId, {
    readyAt:
      Date.now() + JUDGE_MIN_MS + Math.random() * (JUDGE_MAX_MS - JUDGE_MIN_MS),
    verdict,
    comment: comments[Math.floor(Math.random() * comments.length)],
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

/** The AI's reason, once its verdict is visible. */
function judgementComment(taskId: number): string | null {
  const judgement = db.judgements?.get(taskId);
  return judgement && Date.now() >= judgement.readyAt
    ? judgement.comment
    : null;
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
      ai_comment:
        task.type === 'IMAGE' && written?.image_key !== undefined
          ? judgementComment(id)
          : null,
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
 * POST /checklists/{id}/archive. No further runs anywhere; history stays. Its
 * outlets and their people are not touched, so restoring puts it back as it was.
 */
export async function mockArchiveChecklist(id: number): Promise<Checklist> {
  await delay();
  const me = requireAdmin();
  const checklist = findChecklist(me.business.id, id);
  checklist.is_archived = true;
  return toChecklist(checklist);
}

/**
 * POST /checklists/{id}/restore. Undoes archive exactly: its tasks, outlets and
 * their people were never touched, so it runs again from the next generation.
 */
export async function mockRestoreChecklist(id: number): Promise<Checklist> {
  await delay();
  const me = requireAdmin();
  const checklist = findChecklist(me.business.id, id);
  checklist.is_archived = false;
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
