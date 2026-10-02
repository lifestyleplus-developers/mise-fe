/** The transport seam. */
import {
  mockFetchMe,
  mockLogin,
  mockLogout,
  mockUpdateMe,
} from '@/shared/mocks/mock-db';
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  UpdateMeRequest,
} from './types';

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

    /** PATCH /auth/me — returns the updated identity. */
    updateMe(request: UpdateMeRequest): Promise<MeResponse> {
      // TODO(server): PATCH {API_BASE_URL}/api/v1/auth/me
      return mockUpdateMe(request);
    },

    /** POST /auth/logout */
    logout(): Promise<void> {
      // TODO(server): POST {API_BASE_URL}/api/v1/auth/logout
      return mockLogout();
    },
  },
} as const;
