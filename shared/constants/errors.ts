/**
 * Why a sign-in attempt failed.
 *
 * `invalid_credentials` is a platform error code (API Contract §15) — switch
 * on the code, never on the message. `rate_limited` is HTTP 429, which the
 * contract gives a status but no code string. `unreachable` is client-side:
 * the request never came back, so there is no server equivalent.
 */
export const LOGIN_FAILURE = {
  INVALID_CREDENTIALS: 'invalid_credentials',
  RATE_LIMITED: 'rate_limited',
  UNREACHABLE: 'unreachable',
} as const;

export type LoginFailure = (typeof LOGIN_FAILURE)[keyof typeof LOGIN_FAILURE];
