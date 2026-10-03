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
  AmbiguousUsernameBody,
  ApiErrorBody,
  LoginRequest,
  LoginResponse,
  CreateOutletRequest,
  CreateUserRequest,
  MeResponse,
  Outlet,
  Page,
  ResetPasswordRequest,
  Run,
  UpdateMeRequest,
  UpdateOutletRequest,
  UpdateUserRequest,
  User,
  UsersQuery,
} from '@/shared/api/types';
import { API_ERROR_CODE } from '@/shared/api/types';
import { canAdminister, type Role } from '@/shared/constants/roles';
import businesses from './fixtures/businesses.json';
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
};

/**
 * Kept on `globalThis` so a hot reload of this file does not wipe the session
 * and every edit made so far, which would make each call answer token_expired
 * while the screens still show a cached identity.
 */
const store = globalThis as typeof globalThis & { __miseMockDb?: MockDb };
const db: MockDb = (store.__miseMockDb ??= {
  users: users as DbUser[],
  businesses,
  outlets: outletFixtures.map((outlet) => ({ ...outlet })),
  session: null,
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
  total: number;
  answered: number;
};

/** Daily checklists at Indiranagar; assignment ids match the fixture memberships. */
const RUN_TEMPLATES: RunTemplate[] = [
  {
    assignmentId: 11,
    checklist: 'Kitchen Opening',
    outlet: 'Indiranagar',
    open: 360,
    close: 600,
    total: 12,
    answered: 7,
  },
  {
    assignmentId: 13,
    checklist: 'Fridge Temperatures',
    outlet: 'Indiranagar',
    open: 390,
    close: 630,
    total: 6,
    answered: 6,
  },
  {
    assignmentId: 16,
    checklist: 'Store Opening',
    outlet: 'Indiranagar',
    open: 420,
    close: 720,
    total: 8,
    answered: 0,
  },
  {
    assignmentId: 12,
    checklist: 'Kitchen Closing',
    outlet: 'Indiranagar',
    open: 1320,
    close: 1470,
    total: 10,
    answered: 0,
  },
];

/** GET /runs — today's and tomorrow's runs that have not closed, for the caller's assignments. */
export async function mockListRuns(): Promise<Run[]> {
  await delay();
  const me = resolveMe();
  const admin = new Set(me.memberships.cl_admin_assignments);
  const implementer = new Set(me.memberships.cl_imp_assignments);
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
      const close = at(template.close);
      if (close.getTime() <= now) continue;
      runs.push({
        id: template.assignmentId * 100 + dayOffset,
        checklist_name: template.checklist,
        outlet_name: template.outlet,
        window_open: at(template.open).toISOString(),
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
