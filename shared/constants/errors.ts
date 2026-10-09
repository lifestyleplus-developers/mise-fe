/** Why a sign-in attempt failed. */
export const LOGIN_FAILURE = {
  INVALID_CREDENTIALS: 'invalid_credentials',
  RATE_LIMITED: 'rate_limited',
  UNREACHABLE: 'unreachable',
} as const;

export type LoginFailure = (typeof LOGIN_FAILURE)[keyof typeof LOGIN_FAILURE];
