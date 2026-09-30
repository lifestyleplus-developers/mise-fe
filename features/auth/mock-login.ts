import { LOGIN_FAILURE, type LoginFailure } from '@/shared/constants/errors';

/**
 * Stands in for POST /auth/login until the backend exists.
 *
 * The fixture mirrors mise-week-01.html: the named members sign in with any
 * password, and specific inputs exercise each documented failure. Swapping
 * this for the real endpoint should not touch the screen.
 */
const KNOWN_MEMBERS = ['priya', 'raheem', 'suresh', 'meera', 'nadia'];

const TEST_ACCOUNT = { username: 'test-1', password: '1234' };

/** Long enough to see the loading state, short enough not to feel broken. */
const LATENCY_MS = 700;

export type LoginResult =
  { kind: 'ok'; persona: string } | { kind: LoginFailure };

function resolve(username: string, password: string): LoginResult {
  const normalized = username.trim().toLowerCase();

  if (normalized === 'offline') return { kind: LOGIN_FAILURE.UNREACHABLE };
  if (normalized === 'busy') return { kind: LOGIN_FAILURE.RATE_LIMITED };

  if (
    normalized === TEST_ACCOUNT.username &&
    password === TEST_ACCOUNT.password
  ) {
    return { kind: 'ok', persona: normalized };
  }

  if (KNOWN_MEMBERS.includes(normalized) && password !== 'wrong') {
    return { kind: 'ok', persona: normalized };
  }

  // An unknown username is indistinguishable from a wrong password, which is
  // also how the platform answers.
  return { kind: LOGIN_FAILURE.INVALID_CREDENTIALS };
}

export function mockLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  return new Promise((resolvePromise) => {
    setTimeout(() => resolvePromise(resolve(username, password)), LATENCY_MS);
  });
}
