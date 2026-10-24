/**
 * The mock backend: JSON fixtures matching the API Contract's shapes.
 *
 * Who sees what on Home and the tab bar (ZamZam business):
 *   priya (OWNER), raheem (ADMIN) — no assignments → empty Home, Issues, Modules
 *   suresh — implementer + inventory manager → Modules (Inventory)
 *   meera  — attendance manager              → Modules (Attendance)
 *   nadia  — checklist manager               → Issues tab
 *
 * Credentials:
 *   priya, raheem, suresh, meera, nadia — password "demo"
 *   any persona + password "wrong"      — invalid_credentials
 *   busy / anything                     — rate_limited
 *   offline / anything                  — unreachable (no response)
 *   network-error / anything            — 500
 *   test-1 / 1234 (Porch Inn)           — OWNER
 *   test-2 / 1234 (Kebapci)             — MEMBER
 *   anita (Porch Inn)                   — ADMIN, "demo"
 *   kabir (Kebapci)                     — OWNER, "demo"
 *   Give two businesses the same username to exercise the 409 picker.
 */
import type {
  AddMemberRequest,
  AmbiguousUsernameBody,
  AnswerTaskRequest,
  ApiErrorBody,
  AssignmentMember,
  Checklist,
  ChecklistDetail,
  CreateAssignmentsRequest,
  CreateChecklistRequest,
  CreateTaskRequest,
  LoginRequest,
  LoginResponse,
  CreateOutletRequest,
  CreateUserRequest,
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
import { windowOverlapsNextRun } from '@/shared/lib/schedule';
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
  /** Authored checklists, tasks and assignments; seeded on first use. */
  checklistState?: ChecklistState;
};

/**
 * Kept on `globalThis` so a hot reload of this file does not wipe the session
 * and every edit made so far, which would make each call answer token_expired
 * while the screens still show a cached identity.
 */
const store = globalThis as typeof globalThis & { __miseMockDb?: MockDb };
const db: MockDb = (store.__miseMockDb ??= {
  answers: new Map(),
  signedUploadKeys: new Map(),
  users: users as DbUser[],
  businesses,
  outlets: outletFixtures.map((outlet) => ({ ...outlet })),
  session: null,
  startedAt: Date.now(),
});

export class MockApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.code);
    this.status = status;
    this.body = body;
  }
}

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
    throw new MockApiError(401, {
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
      role: user.tenant_role,
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
  if (outcome.status !== 200)
    throw new MockApiError(outcome.status, outcome.body);
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
  return new MockApiError(status, {
    error: { code, message, field: field ?? null },
  });
}

/** The signed-in ADMIN or OWNER; anyone else is refused, as the platform does. */
function requireAdmin() {
  const me = resolveMe();
  if (!canAdminister(me.user.role)) {
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
    role: user.tenant_role,
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
function actorRelation(viewer: { id: number; role: Role }, target: DbUser) {
  const self = target.id === viewer.id;
  const ownerTarget = target.tenant_role === 'OWNER';
  const peerAdmin =
    viewer.role === 'ADMIN' && target.tenant_role === 'ADMIN' && !self;
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
        a.full_name.localeCompare(b.full_name),
    );
  const start = (query.page - 1) * query.pageSize;
  return {
    count: matches.length,
    next: start + query.pageSize < matches.length ? query.page + 1 : null,
    previous: query.page > 1 ? query.page - 1 : null,
    results: matches.slice(start, start + query.pageSize).map(toUser),
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
  if (request.role === 'OWNER') {
    throw apiError(409, 'owner_exists', 'There is already an Owner.');
  }
  if (request.role === 'ADMIN' && me.user.role !== 'OWNER') {
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
    tenant_role: request.role,
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

  if (request.role !== undefined && request.role !== user.tenant_role) {
    if (forbidden) throw apiError(403, 'authoring_forbidden', 'Not permitted.');
    if (request.role === 'OWNER') {
      throw apiError(409, 'owner_exists', 'There is already an Owner.');
    }
    if (request.role === 'ADMIN' && me.user.role !== 'OWNER') {
      throw apiError(403, 'authoring_forbidden', 'Not permitted.');
    }
  }
  if (request.is_active !== undefined && request.is_active !== user.is_active) {
    if (forbidden) throw apiError(403, 'authoring_forbidden', 'Not permitted.');
  }

  if (request.full_name !== undefined)
    user.full_name = request.full_name.trim();
  if (request.role !== undefined) user.tenant_role = request.role;
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
    (ownerTarget && me.user.role !== 'OWNER')
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

/** Daily checklists at ZamZam; assignment ids match the fixture memberships. */
const RUN_TEMPLATES: RunTemplate[] = [
  {
    assignmentId: 11,
    checklist: 'Kitchen Opening',
    outlet: 'ZamZam',
    open: 360,
    close: 600,
    todayFromNow: { open: -90, close: 150 },
    total: 12,
    answered: 7,
  },
  {
    assignmentId: 13,
    checklist: 'Fridge Temperatures',
    outlet: 'ZamZam',
    open: 390,
    close: 630,
    todayFromNow: { open: -60, close: 120 },
    total: 6,
    answered: 4,
  },
  {
    assignmentId: 16,
    checklist: 'Store Opening',
    outlet: 'ZamZam',
    open: 420,
    close: 720,
    todayFromNow: { open: -30, close: 180 },
    total: 8,
    answered: 3,
  },
  {
    assignmentId: 12,
    checklist: 'Kitchen Closing',
    outlet: 'ZamZam',
    open: 1320,
    close: 1470,
    total: 10,
    answered: 0,
  },
  // Porch Inn — assignment ids match the fixture memberships.
  {
    assignmentId: 701,
    checklist: 'Front Desk Shift Handover',
    outlet: 'Porch Inn Main',
    open: 420,
    close: 600,
    todayFromNow: { open: -45, close: 135 },
    total: 6,
    answered: 2,
  },
  {
    assignmentId: 702,
    checklist: 'Front Desk Shift Handover',
    outlet: 'Porch Inn Annex',
    open: 420,
    close: 600,
    todayFromNow: { open: -75, close: 105 },
    total: 6,
    answered: 6,
  },
  {
    assignmentId: 705,
    checklist: 'Public Area Walk',
    outlet: 'Porch Inn Main',
    open: 480,
    close: 525,
    todayFromNow: { open: -10, close: 35 },
    total: 5,
    answered: 0,
  },
  {
    assignmentId: 703,
    checklist: 'Room Turnover Check',
    outlet: 'Porch Inn Main',
    open: 540,
    close: 840,
    todayFromNow: { open: -60, close: 200 },
    total: 7,
    answered: 4,
  },
  {
    assignmentId: 704,
    checklist: 'Room Turnover Check',
    outlet: 'Porch Inn Annex',
    open: 540,
    close: 840,
    todayFromNow: { open: -20, close: 240 },
    total: 7,
    answered: 7,
  },
  {
    assignmentId: 707,
    checklist: 'Night Audit',
    outlet: 'Porch Inn Main',
    open: 1380,
    close: 1500,
    total: 5,
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
const TASK_TEMPLATES: Record<number, TaskTemplate[]> = {
  // Kitchen Opening
  11: [
    {
      type: 'NUMBER',
      text: 'Walk-in cooler temperature',
      unit: '°C',
      max: 4,
      answer: { n: 3.8, by: 'kiran' },
    },
    {
      type: 'NUMBER',
      text: 'Walk-in freezer temperature',
      unit: '°C',
      max: -18,
      answer: {
        n: -15,
        comment: 'Door was left open during the delivery',
        by: 'suresh',
      },
    },
    {
      type: 'BINARY',
      text: 'Sanitation stations are stocked',
      answer: { b: true, by: 'suresh' },
    },
    {
      type: 'BINARY',
      text: 'No expired items in open containers',
      answer: { b: true, by: 'kiran' },
    },
    {
      type: 'BINARY',
      text: 'Gas valves are checked and burners light',
      answer: { b: true, by: 'kiran' },
    },
    {
      type: 'BINARY',
      text: 'Exhaust hood is running',
      answer: { b: true, by: 'suresh' },
    },
    {
      type: 'BINARY',
      text: 'Chopping boards and knives are sanitised',
      answer: { b: true, by: 'kiran' },
    },
    {
      type: 'BINARY',
      text: 'Staff are in clean uniform and caps',
      answer: { b: true, by: 'kiran' },
    },
    {
      type: 'NUMBER',
      text: 'Sanitiser solution strength',
      unit: 'ppm',
      min: 50,
      max: 200,
      answer: { n: 100, by: 'kiran' },
    },
    {
      type: 'BINARY',
      text: 'Handwash sink has soap and towels',
      answer: {
        b: false,
        comment: 'Soap dispenser empty, refill requested',
        by: 'kiran',
      },
    },
    {
      type: 'IMAGE',
      text: 'Photograph the prep counter',
      answer: { by: 'kiran' },
    },
    {
      type: 'BINARY',
      text: 'Waste bins are lined and covered',
      answer: { b: true, by: 'kiran' },
    },
  ],
  // Fridge Temperatures
  13: [
    {
      type: 'NUMBER',
      text: 'Walk-in cooler temperature',
      unit: '°C',
      max: 4,
      answer: { n: 3.5, by: 'kiran' },
    },
    {
      type: 'BINARY',
      text: 'Freezer door seals are intact',
      answer: {
        b: false,
        comment: 'Seal damaged, engineer called',
        by: 'suresh',
      },
    },
    {
      type: 'BINARY',
      text: 'Thermometers are in place',
      answer: { b: true, by: 'suresh' },
    },
    {
      type: 'NUMBER',
      text: 'Walk-in freezer temperature',
      unit: '°C',
      max: -18,
      answer: { n: -19, by: 'kiran' },
    },
    { type: 'NUMBER', text: 'Display chiller temperature', unit: '°C', max: 5 },
    { type: 'IMAGE', text: 'Photograph the walk-in cooler thermometer' },
  ],
  // Store Opening
  16: [
    {
      type: 'BINARY',
      text: 'Entrance and waiting area are clean',
      answer: { b: true, by: 'kiran' },
    },
    {
      type: 'BINARY',
      text: 'ഹാൻഡ് വാഷ് ലിക്വിഡ് എല്ലാ വാഷ് ബേസിനുകളിലും നിറച്ചിട്ടുണ്ടെന്നും ടിഷ്യൂ പേപ്പർ ആവശ്യത്തിന് ഉണ്ടെന്നും ഉറപ്പാക്കുക',
      answer: { b: true, by: 'kiran' },
    },
    {
      type: 'BINARY',
      text: 'Lights and fans are working',
      answer: { b: true, by: 'kiran' },
    },
    {
      type: 'NUMBER',
      text: 'Dining room temperature',
      unit: '°C',
      min: 22,
      max: 26,
    },
    { type: 'BINARY', text: 'Tables and chairs are set' },
    { type: 'BINARY', text: 'Drinking water is filled' },
    { type: 'BINARY', text: 'Floor is clean and dry' },
    { type: 'IMAGE', text: 'Photograph the dining room' },
  ],
  // Front Desk Shift Handover
  701: [
    {
      type: 'NUMBER',
      text: 'Cash drawer count',
      unit: '₹',
      min: 9500,
      max: 10500,
      answer: { n: 10120, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'VIP arrivals are noted for the next shift',
      answer: { b: true, by: 'test-1' },
    },
    { type: 'BINARY', text: 'Pending guest complaints are handed over' },
    { type: 'BINARY', text: 'Room status matches the system' },
    { type: 'BINARY', text: 'Key cards are counted and stored' },
    { type: 'IMAGE', text: 'Photograph the signed handover sheet' },
  ],
  // Front Desk Shift Handover, Annex: every task answered
  702: [
    {
      type: 'NUMBER',
      text: 'Cash drawer count',
      unit: '₹',
      min: 9500,
      max: 10500,
      answer: { n: 10240, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'VIP arrivals are noted for the next shift',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'Pending guest complaints are handed over',
      answer: {
        b: false,
        comment: 'Room 12 AC complaint still open',
        by: 'test-1',
      },
    },
    {
      type: 'BINARY',
      text: 'Room status matches the system',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'Key cards are counted and stored',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'IMAGE',
      text: 'Photograph the signed handover sheet',
      answer: { by: 'test-1' },
    },
  ],
  // Public Area Walk
  705: [
    { type: 'BINARY', text: 'Lobby floor is clean and dry' },
    { type: 'BINARY', text: 'Lift is clean and working' },
    { type: 'BINARY', text: 'Corridor lights are all on' },
    { type: 'BINARY', text: 'Restrooms are stocked and clean' },
    { type: 'IMAGE', text: 'Photograph the lobby' },
  ],
  // Room Turnover Check
  703: [
    {
      type: 'BINARY',
      text: 'Bed linen is changed',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'Bathroom is sanitised',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'Minibar is restocked',
      answer: {
        b: false,
        comment: 'Two soft drinks missing from stores',
        by: 'test-1',
      },
    },
    {
      type: 'NUMBER',
      text: 'Room temperature',
      unit: '°C',
      min: 22,
      max: 26,
      answer: { n: 28, comment: 'AC filter being cleaned', by: 'test-1' },
    },
    { type: 'BINARY', text: 'Amenities are replenished' },
    { type: 'BINARY', text: 'Do-not-disturb sign is removed' },
    { type: 'IMAGE', text: 'Photograph the finished room' },
  ],
  704: [
    {
      type: 'BINARY',
      text: 'Bed linen is changed',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'Bathroom is sanitised',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'Minibar is restocked',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'NUMBER',
      text: 'Room temperature',
      unit: '°C',
      min: 22,
      max: 26,
      answer: { n: 24, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'Amenities are replenished',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'BINARY',
      text: 'Do-not-disturb sign is removed',
      answer: { b: true, by: 'test-1' },
    },
    {
      type: 'IMAGE',
      text: 'Photograph the finished room',
      answer: { by: 'test-1' },
    },
  ],
  // Night Audit
  707: [
    { type: 'BINARY', text: 'Revenue is reconciled' },
    { type: 'BINARY', text: 'No-shows are processed' },
    { type: 'BINARY', text: 'System backup has run' },
    { type: 'BINARY', text: "Tomorrow's arrival list is printed" },
    { type: 'IMAGE', text: 'Photograph the signed audit summary' },
  ],
  // Kitchen Closing
  12: [
    { type: 'BINARY', text: 'Burners and gas valves are off' },
    { type: 'NUMBER', text: 'Walk-in cooler temperature', unit: '°C', max: 4 },
    { type: 'BINARY', text: 'Perishables are covered and labelled' },
    { type: 'BINARY', text: 'Chopping boards and knives are washed' },
    { type: 'BINARY', text: 'Floors are mopped and drains are clear' },
    { type: 'BINARY', text: 'Exhaust hood is switched off' },
    { type: 'IMAGE', text: 'Photograph the cleaned prep counter' },
    { type: 'BINARY', text: 'Waste is out and bins are relined' },
    { type: 'BINARY', text: 'Back door is locked' },
    { type: 'BINARY', text: 'Alarm is set' },
  ],
};

function outcomeFor(
  task: TaskTemplate,
  fallback: NonNullable<TaskTemplate['answer']> | undefined,
  written?: AnswerTaskRequest,
): RunTask['outcome'] {
  if (task.type === 'IMAGE') {
    return written?.image_key !== undefined ? 'PENDING_JUDGEMENT' : 'PASS';
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
        ? outcomeFor(task, templateAnswer, written)
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
type DbAssignment = OutletAssignment & {
  tenant_id: number;
  /** Latest finished period's score, 0–100; null before one has closed. */
  score: number | null;
};

/**
 * Authored content, mutable for the length of a session. Who is on an
 * assignment is not stored here: it lives in each user's `memberships`, the
 * same place `/auth/me` and Home read it from, so the two cannot disagree.
 */
type ChecklistState = {
  checklists: DbChecklist[];
  assignments: DbAssignment[];
  tasks: DbTask[];
  nextTaskId: number;
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

  // The longest list a person might write (CHK-09 "30 tasks").
  const longest = checklists.find((checklist) => checklist.id === 105);
  if (longest) {
    addTasks(
      longest,
      Array.from({ length: 30 }, (_, index) => ({
        type: 'BINARY' as const,
        text: `Delivery item ${index + 1} is in good condition`,
      })),
    );
  }

  return { checklists, assignments, tasks, nextTaskId };
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
  if (!canAdminister(me.user.role) && !isOnChecklist(me, id)) {
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

function toOutletAssignment({
  tenant_id: _tenant,
  score: _score,
  ...assignment
}: DbAssignment): OutletAssignment {
  return assignment;
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
    schedule.deadline_minutes <= 0
  ) {
    throw invalid('The window must be longer than zero.', 'deadline_minutes');
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

  if (
    windowOverlapsNextRun(
      schedule.recurrence,
      schedule.weekdays,
      schedule.deadline_minutes,
    )
  ) {
    throw apiError(
      409,
      API_ERROR_CODE.WINDOW_OVERLAPS_NEXT_PERIOD,
      'The window must be shorter than the gap between runs.',
      'deadline_minutes',
    );
  }
}

/**
 * GET /checklists — scoped to what the caller can see (§5): ADMIN/OWNER get
 * every checklist, anyone else only those where they are CL_ADMIN or CL_IMP.
 * Archived ones are left out unless an admin asks for them (CHK-10).
 */
export async function mockListChecklists(
  page: number,
  pageSize: number,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Page<ChecklistListItem>> {
  await delay();
  const me = resolveMe();
  const admin = new Set(me.memberships.cl_admin_assignments);
  const implementer = new Set(me.memberships.cl_imp_assignments);
  const state = checklistState();
  const mayAdminister = canAdminister(me.user.role);

  const all: ChecklistListItem[] = [];
  for (const checklist of state.checklists) {
    if (checklist.tenant_id !== me.business.id) continue;
    if (checklist.is_archived && !(includeArchived && mayAdminister)) continue;
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

  // The admin list is ordered by opening time, so paging does not reshuffle.
  if (includeArchived && mayAdminister) {
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
  assertReachable(next.name);
  assertValidSchedule(next);
  Object.assign(checklist, next);
  return toChecklist(checklist);
}

/**
 * POST /checklists/{id}/archive. No further runs anywhere; history stays, and
 * so do its people, should it ever come back.
 */
export async function mockArchiveChecklist(id: number): Promise<Checklist> {
  await delay();
  const me = requireAdmin();
  const checklist = findChecklist(me.business.id, id);
  checklist.is_archived = true;
  for (const assignment of activeAssignments(id)) assignment.is_active = false;
  return toChecklist(checklist);
}

/**
 * POST /checklists/{id}/restore. Not in the contract: it has archive and no
 * way back (plan §4, question 8). Assumed so CHK-06's Restore can be built;
 * outlets stay stopped until someone ticks them again.
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
}) {
  const invalid = (message: string, field: string) =>
    apiError(400, API_ERROR_CODE.VALIDATION_ERROR, message, field);

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
    requires_comment_on_fail:
      request.requires_comment_on_fail ?? request.answer_type !== 'IMAGE',
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
  };
  assertReachable(next.text);
  assertValidTask(next);
  Object.assign(task, next);
  if (request.requires_comment_on_fail !== undefined) {
    task.requires_comment_on_fail = request.requires_comment_on_fail;
  }
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
  return checklistState()
    .assignments.filter((a) => a.checklist_id === checklistId)
    .map(toOutletAssignment);
}

/**
 * POST /checklists/{id}/assignments — bulk. An outlet already running is left
 * alone; one that was stopped starts again with the people it had.
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

  return outlets.map((outlet) => {
    const existing = state.assignments.find(
      (a) => a.checklist_id === checklist.id && a.outlet_id === outlet.id,
    );
    if (existing) {
      existing.is_active = true;
      return toOutletAssignment(existing);
    }
    const assignment: DbAssignment = {
      id: Math.max(0, ...state.assignments.map((a) => a.id)) + 1,
      tenant_id: me.business.id,
      checklist_id: checklist.id,
      outlet_id: outlet.id,
      outlet_name: outlet.name,
      score: null,
      is_active: true,
    };
    state.assignments.push(assignment);
    return toOutletAssignment(assignment);
  });
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

/** The assignment, for someone allowed to see its people. */
function findAssignmentForTeam(me: MeResponse, id: number): DbAssignment {
  const assignment = findAssignment(me.business.id, id);
  if (!canAdminister(me.user.role) && !callerRole(me, id)) {
    throw apiError(
      403,
      API_ERROR_CODE.NOT_YOUR_ASSIGNMENT,
      'Not your assignment.',
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
  if (canAdminister(me.user.role)) return;
  if (callerRole(me, assignmentId) === 'CL_ADMIN' && role === 'CL_IMP') return;
  throw apiError(
    403,
    API_ERROR_CODE.NOT_YOUR_ASSIGNMENT,
    'Not permitted to change this team.',
  );
}

function membersOf(tenantId: number, assignmentId: number): AssignmentMember[] {
  const members: AssignmentMember[] = [];
  for (const user of db.users) {
    if (user.tenant_id !== tenantId) continue;
    for (const role of ['CL_ADMIN', 'CL_IMP'] as const) {
      if (user.memberships[MEMBERSHIP_KEY[role]].includes(assignmentId)) {
        members.push({
          user_id: user.id,
          full_name: user.full_name,
          role,
          is_active: user.is_active,
        });
      }
    }
  }
  return members.sort(
    (a, b) =>
      a.role.localeCompare(b.role) || a.full_name.localeCompare(b.full_name),
  );
}

/** GET /assignments/{id}/members — both buckets, supervisors first. */
export async function mockListMembers(
  assignmentId: number,
): Promise<AssignmentMember[]> {
  await delay();
  const me = resolveMe();
  findAssignmentForTeam(me, assignmentId);
  return membersOf(me.business.id, assignmentId);
}

/**
 * POST /assignments/{id}/members. 409 `role_conflict` when the person is
 * already on it in either role: one row per person per assignment (Schema).
 */
export async function mockAddMember(
  assignmentId: number,
  request: AddMemberRequest,
): Promise<AssignmentMember> {
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
  const already = membersOf(me.business.id, assignmentId).some(
    (member) => member.user_id === user.id,
  );
  if (already) {
    throw apiError(
      409,
      API_ERROR_CODE.ROLE_CONFLICT,
      'Already on this checklist here.',
      'user_id',
    );
  }
  user.memberships[MEMBERSHIP_KEY[request.role]].push(assignmentId);
  return {
    user_id: user.id,
    full_name: user.full_name,
    role: request.role,
    is_active: user.is_active,
  };
}

/** DELETE /assignments/{id}/members/{user_id}. */
export async function mockRemoveMember(
  assignmentId: number,
  userId: number,
): Promise<void> {
  await delay();
  const me = resolveMe();
  const assignment = findAssignmentForTeam(me, assignmentId);
  const member = membersOf(me.business.id, assignmentId).find(
    (candidate) => candidate.user_id === userId,
  );
  if (!member) throw apiError(404, API_ERROR_CODE.NOT_FOUND, 'Not found.');
  assertMayChangeTeam(me, assignmentId, member.role);
  findEditableChecklist(me, assignment.checklist_id);

  const user = db.users.find((candidate) => candidate.id === userId)!;
  const key = MEMBERSHIP_KEY[member.role];
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
  if (new Date(run.window_close).getTime() <= Date.now()) {
    throw apiError(409, 'window_closed', 'This checklist closed.');
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
