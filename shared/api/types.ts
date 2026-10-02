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
