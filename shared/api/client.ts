/** The transport seam. */
import {
  mockArchiveOutlet,
  mockCreateOutlet,
  mockCreateUser,
  mockFetchMe,
  mockGetOutlet,
  mockGetUser,
  mockListOutlets,
  mockListRuns,
  mockListUsers,
  mockLogin,
  mockLogout,
  mockResetPassword,
  mockUpdateMe,
  mockUpdateOutlet,
  mockUpdateUser,
} from '@/shared/mocks/mock-db';
import type {
  CreateOutletRequest,
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  Outlet,
  Page,
  ResetPasswordRequest,
  Run,
  UpdateMeRequest,
  UpdateOutletRequest,
  UpdateUserRequest,
  User,
  UsersQuery,
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
  runs: {
    /** GET /runs — only what the caller may act on; closed runs never come back. */
    list(): Promise<Run[]> {
      // TODO(server): GET {API_BASE_URL}/api/v1/runs (paginated)
      return mockListRuns();
    },
  },
  users: {
    /** GET /users?role=&is_active=&search=&page=&page_size= */
    list(query: UsersQuery): Promise<Page<User>> {
      // TODO(server): GET {API_BASE_URL}/api/v1/users
      return mockListUsers(query);
    },

    /** GET /users/{id} */
    get(id: number): Promise<User> {
      // TODO(server): GET {API_BASE_URL}/api/v1/users/{id}
      return mockGetUser(id);
    },

    /** POST /users */
    create(request: CreateUserRequest): Promise<User> {
      // TODO(server): POST {API_BASE_URL}/api/v1/users
      return mockCreateUser(request);
    },

    /** PATCH /users/{id} */
    update(id: number, request: UpdateUserRequest): Promise<User> {
      // TODO(server): PATCH {API_BASE_URL}/api/v1/users/{id}
      return mockUpdateUser(id, request);
    },

    /** POST /users/{id}/reset-password */
    resetPassword(id: number, request: ResetPasswordRequest): Promise<void> {
      // TODO(server): POST {API_BASE_URL}/api/v1/users/{id}/reset-password
      return mockResetPassword(id, request);
    },
  },
} as const;
