/**
 * The transport seam. Everything above this line — hooks, screens — codes
 * against `api`; below it is the only place that knows how calls are
 * answered. Today that is the mock db; when the real endpoints exist these
 * three bodies become `fetch` calls against API_BASE_URL and nothing else in
 * the app changes (mise-fe/AGENTS.md, "Mocking the backend").
 *
 * Deliberately framework-free: no React, no Query — so it stays testable and
 * the swap stays mechanical.
 */
import { mockFetchMe, mockLogin, mockLogout } from '@/shared/mocks/mock-db';
import type { LoginRequest, LoginResponse, MeResponse } from './types';

export { MockApiError } from '@/shared/mocks/mock-db';

export const api = {
  auth: {
    /** POST /auth/login */
    login(request: LoginRequest): Promise<LoginResponse> {
      // TODO(server): POST {API_BASE_URL}/api/v1/auth/login
      return mockLogin(request);
    },

    /** GET /auth/me — called on every launch; it drives navigation (§2). */
    me(): Promise<MeResponse> {
      // TODO(server): GET {API_BASE_URL}/api/v1/auth/me
      return mockFetchMe();
    },

    /** POST /auth/logout */
    logout(): Promise<void> {
      // TODO(server): POST {API_BASE_URL}/api/v1/auth/logout
      return mockLogout();
    },
  },
} as const;
