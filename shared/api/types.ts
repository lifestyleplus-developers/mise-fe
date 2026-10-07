/** Hand-written against the API Contract's JSON examples; no codegen yet. */
import type { Role } from '@/shared/constants/roles';

/** API Contract §1 — one error shape everywhere. Switch on code, never message. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    field: string | null;
  };
};

/** §15 — the codes something in the app switches on. Grows as endpoints land. */
export const API_ERROR_CODE = {
  INVALID_CREDENTIALS: 'invalid_credentials',
  TOKEN_EXPIRED: 'token_expired',
  AMBIGUOUS_USERNAME: 'ambiguous_username',
  VALIDATION_ERROR: 'validation_error',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];

/** POST /auth/login. */
export type LoginRequest = {
  username: string;
  password: string;
  /** Sent only when resending after an ambiguous_username 409. */
  tenant_id?: number;
};

/** POST /auth/login → 200. Real tokens; the mock issues opaque placeholders. */
export type LoginResponse = {
  access: string;
  refresh: string;
};

/** POST /auth/login → 409 `ambiguous_username` — §2's businesses array. */
export type AmbiguousUsernameBody = {
  businesses: BusinessRef[];
};

/** A business the username exists in, offered by the 409. */
export type BusinessRef = {
  id: number;
  name: string;
};

/** GET /auth/me — §2: call on every launch; it drives navigation. */
export type MeResponse = {
  user: {
    id: number;
    username: string;
    full_name: string;
    role: Role;
    interface_language: 'EN' | 'HI' | 'ML' | 'KN';
  };
  business: {
    id: number;
    name: string;
  };
  modules: {
    checklists: boolean;
    inventory: boolean;
    attendance_outlets: number[];
    spot_check_outlets: number[];
  };
  /** Module roles and per-assignment roles, as membership rows (§2). */
  memberships: {
    cl_admin_assignments: number[];
    cl_imp_assignments: number[];
    attendance_configs: number[];
    inventory_outlets: number[];
    spot_check_outlets: number[];
  };
};

/** PATCH /auth/me — §2: the only self-editable field. */
export type UpdateMeRequest = {
  interface_language: MeResponse['user']['interface_language'];
};

/** API Contract §3 — an outlet. */
export type Outlet = {
  id: number;
  name: string;
  attendance_enabled: boolean;
  spot_checks_enabled: boolean;
  is_archived: boolean;
};

/** POST /outlets. */
export type CreateOutletRequest = { name: string };

/** PATCH /outlets/{id} — rename, or toggle a module. */
export type UpdateOutletRequest = Partial<
  Pick<Outlet, 'name' | 'attendance_enabled' | 'spot_checks_enabled'>
>;

/** API Contract §1 — every list is paginated. */
export type Page<T> = {
  count: number;
  next: number | null;
  previous: number | null;
  results: T[];
};

/** API Contract §4 — a person in the business. No email field exists. */
export type User = {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  is_active: boolean;
};

/** GET /users filters. */
export type UsersQuery = {
  page: number;
  pageSize: number;
  role?: Role;
  isActive?: boolean;
  search?: string;
};

/** POST /users. */
export type CreateUserRequest = {
  username: string;
  password: string;
  full_name: string;
  role: Role;
};

/** PATCH /users/{id}. */
export type UpdateUserRequest = Partial<
  Pick<User, 'full_name' | 'role' | 'is_active'>
>;

/** POST /users/{id}/reset-password. */
export type ResetPasswordRequest = { password: string };

/** API Contract §7 — one occurrence of one assignment, as Home lists it. */
export type Run = {
  id: number;
  checklist_name: string;
  outlet_name: string;
  window_open: string;
  window_close: string;
  total_tasks: number;
  answered_count: number;
  status: 'OPEN';
  /** Which part the caller plays on this run's assignment. */
  my_role: 'CL_ADMIN' | 'CL_IMP';
};

/** API Contract §5 — a checklist template. */
export type Checklist = {
  id: number;
  name: string;
  recurrence: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  /** HH:MM, business-local. */
  st_time: string;
  deadline_minutes: number;
  /** WEEKLY only; 1 = Monday … 7 = Sunday. */
  weekdays: number[] | null;
  /** MONTHLY only. */
  day_of_month: number | null;
  is_archived: boolean;
};

/** One outlet a checklist runs at, with the caller's part on it. */
export type ChecklistAssignment = {
  id: number;
  outlet_name: string;
  /** Latest finished period's score, 0–100; null before any period has closed. */
  score: number | null;
  /** Null for an ADMIN/OWNER who is on the assignment as neither bucket. */
  my_role: 'CL_ADMIN' | 'CL_IMP' | null;
};

/**
 * GET /checklists row. The contract (§5) lists only the checklist fields; the
 * assignments and scores FE Spec §3.4 asks for ("the outlets it runs at that
 * you can see, and the most recent score") are not in it yet. Assumed here as
 * a nested array until Lamax confirms the shape.
 */
export type ChecklistListItem = Checklist & {
  assignments: ChecklistAssignment[];
};
