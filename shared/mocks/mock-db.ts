/**
 * The mock backend. JSON fixtures in-repo matching the API Contract's exact
 * shapes — mise-fe/AGENTS.md rules out MSW for RN, and the API layer reads
 * these until real endpoints exist, swapping internally so hooks and screens
 * never change.
 *
 * The db is a fixture *plus mutation writes*, deliberately: AGENTS.md
 * requires mutations to affect subsequent reads within a session. Login
 * writes `session`; logout clears it. A purely static fixture cannot do
 * that, and session-in-the-db is the shape the real flow keeps — `GET
 * /auth/me` becomes a real server read with a real token later.
 *
 * Credentials, for want of a better place while there is no Settings screen:
 *   priya, raheem, suresh, meera, nadia — password "demo" signs in
 *   any persona + password "wrong"      — exercises invalid_credentials
 *   busy / anything                     — exercises rate_limited
 *   offline / anything                  — exercises unreachable (thrown before
 *                                         a response exists)
 *   test-1 / 1234                       — exercises ambiguous_username (exists
 *                                         in two businesses); resend with a
 *                                         tenant_id from the 409 to get in
 *   network-error / anything            — 500, the generic server-fault path
 */
import type {
  AmbiguousUsernameBody,
  ApiErrorBody,
  LoginRequest,
  LoginResponse,
  MeResponse,
} from '@/shared/api/types';
import { API_ERROR_CODE } from '@/shared/api/types';
import businesses from './fixtures/businesses.json';
import users from './fixtures/users.json';

type DbUser = {
  id: number;
  tenant_id: number;
  username: string;
  password: string;
  full_name: string;
  tenant_role: 'OWNER' | 'ADMIN' | 'MEMBER';
  interface_language: 'EN' | 'HI' | 'ML' | 'KN';
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

  // Magic usernames drive documented failure paths.
  if (username === 'offline') {
    // Simulates the transport dying: the request never gets a response, so
    // this is a thrown network error, not a MockApiError — the same shape a
    // real fetch produces when the server is unreachable.
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

  // §2: same username in more than one business → 409 with a businesses
  // array; resend with tenant_id included.
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
    // Unknown username is indistinguishable from a wrong password — also how
    // the platform answers.
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
    // A caller hitting /auth/me with no session is a client bug in the real
    // flow; the mock answers with an expired token rather than inventing a
    // user.
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
      checklists: true,
      inventory: true,
      attendance_outlets: [],
      spot_check_outlets: [],
    },
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

/** POST /auth/logout */
export async function mockLogout(): Promise<void> {
  await delay();
  db.session = null;
}
