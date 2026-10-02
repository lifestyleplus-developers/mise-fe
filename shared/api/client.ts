/** The transport seam. */
import {
  mockArchiveOutlet,
  mockCreateOutlet,
  mockFetchMe,
  mockGetOutlet,
  mockListOutlets,
  mockLogin,
  mockLogout,
  mockUpdateMe,
  mockUpdateOutlet,
} from '@/shared/mocks/mock-db';
import type {
  CreateOutletRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  Outlet,
  UpdateMeRequest,
  UpdateOutletRequest,
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
  outlets: {
    /** GET /outlets?include_archived=true */
    list(): Promise<Outlet[]> {
      // TODO(server): GET {API_BASE_URL}/api/v1/outlets?include_archived=true (paginated)
      return mockListOutlets();
    },

    /** GET /outlets/{id} */
    get(id: number): Promise<Outlet> {
      // TODO(server): GET {API_BASE_URL}/api/v1/outlets/{id}
      return mockGetOutlet(id);
    },

    /** POST /outlets */
    create(request: CreateOutletRequest): Promise<Outlet> {
      // TODO(server): POST {API_BASE_URL}/api/v1/outlets
      return mockCreateOutlet(request);
    },

    /** PATCH /outlets/{id} */
    update(id: number, request: UpdateOutletRequest): Promise<Outlet> {
      // TODO(server): PATCH {API_BASE_URL}/api/v1/outlets/{id}
      return mockUpdateOutlet(id, request);
    },

    /** POST /outlets/{id}/archive */
    archive(id: number): Promise<Outlet> {
      // TODO(server): POST {API_BASE_URL}/api/v1/outlets/{id}/archive
      return mockArchiveOutlet(id);
    },
  },
} as const;
