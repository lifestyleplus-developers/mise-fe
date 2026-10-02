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
 *   test-1 / 1234 (Porch Inn)           — ADMIN
 *   test-2 / 1234 (Kebapci)             — MEMBER
 *   anita (Porch Inn), kabir (Kebapci)  — owners, "demo"
 *   Give two businesses the same username to exercise the 409 picker.
 */
import type {
  AmbiguousUsernameBody,
  ApiErrorBody,
  LoginRequest,
  LoginResponse,
  CreateOutletRequest,
  MeResponse,
  Outlet,
  UpdateMeRequest,
  UpdateOutletRequest,
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
};

/** Long enough to see the loading state, short enough not to feel broken. */
const NETWORK_DELAY_MS = 700;

type Session = { userId: number; token: string };

/** In-session state — login writes it, logout clears it. */
let db: {
  users: DbUser[];
  businesses: typeof businesses;
  outlets: DbOutlet[];
  session: Session | null;
} = {
  users: users as DbUser[],
  businesses,
  outlets: outletFixtures.map((outlet) => ({ ...outlet })),
  session: null,
};

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

  if (!user || user.password !== request.password) {
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
