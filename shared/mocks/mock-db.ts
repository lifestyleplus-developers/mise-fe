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
  MeResponse,
  UpdateMeRequest,
} from '@/shared/api/types';
import { API_ERROR_CODE } from '@/shared/api/types';
import type { Role } from '@/shared/constants/roles';
import businesses from './fixtures/businesses.json';
import users from './fixtures/users.json';

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
  session: Session | null;
} = {
  users: users as DbUser[],
  businesses,
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
    modules: business.modules,
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
