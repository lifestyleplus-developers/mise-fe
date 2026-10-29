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
 * POST /auth/logout with the refresh token (204). The tokens are cleared even
 * if the call fails, so this device is signed out whatever the network does.
 */
export async function logoutRequest(): Promise<void> {
  const tokens = await getTokens();
  try {
    if (tokens) {
      await request<void>('/auth/logout', {
        method: 'POST',
        body: { refresh: tokens.refresh },
      });
    }
  } finally {
    await clearTokens();
  }
}
