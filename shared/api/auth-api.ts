import { request } from './http';
import { clearTokens, getTokens, setTokens, type Tokens } from './session';
import type { LoginRequest, LoginResponse } from './types';

/**
 * POST /auth/login. The tokens are kept here, so the caller only has to ask
 * `/auth/me` next. A 409 `ambiguous_username` throws an `ApiError` as usual.
 */
export async function loginRequest(
  login: LoginRequest,
): Promise<LoginResponse> {
  const tokens = await request<Tokens>('/auth/login', {
    method: 'POST',
    body: login,
    authenticated: false,
  });
  await setTokens(tokens);
  return tokens;
}

/**
 * POST /auth/logout with the refresh token (204). The tokens are cleared first,
 * before the network call, so this device is signed out whatever the network
 * does, and a person who signs in straight afterwards keeps their new tokens.
 * The call is sent with the tokens taken before the clearing. It is best effort:
 * if it fails the refresh token simply stays valid on the server until it expires.
 */
/** PATCH /auth/push-token (204): this phone's Expo token, or null to stop pushes. */
export async function pushTokenRequest(
  pushToken: string | null,
): Promise<void> {
  await request<void>('/auth/push-token', {
    method: 'PATCH',
    body: { push_token: pushToken },
  });
}

export async function logoutRequest(): Promise<void> {
  const tokens = await getTokens();
  await clearTokens();
  if (tokens) {
    // This phone stops receiving this person's pushes (API Contract §14). Best
    // effort, and before logout so the access token is still good.
    await request<void>('/auth/push-token', {
      method: 'PATCH',
      body: { push_token: null },
      authenticated: false,
      access: tokens.access,
    }).catch(() => undefined);
    await request<void>('/auth/logout', {
      method: 'POST',
      body: { refresh: tokens.refresh },
      authenticated: false,
      access: tokens.access,
    });
  }
}
