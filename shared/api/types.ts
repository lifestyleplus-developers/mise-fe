/**
 * Hand-written against the API Contract's JSON examples — mise-fe/AGENTS.md
 * defers codegen until Lamax's OpenAPI schema exists (their backend is not
 * live). When codegen lands these are replaced, not edited: the layer's
 * internals change; hooks and screens never see the difference.
 *
 * Only what the app consumes today. Growing this file endpoint by endpoint
 * is the point — do not pre-declare the whole contract.
 */
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
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];

/**
 * POST /auth/login. §2: no tenant_id in any path, query or body — the one
 * exception is the resend after an `ambiguous_username` 409.
 */
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

/**
 * GET /auth/me — §2: call on every launch; it drives navigation. Tab
 * visibility is built from `modules` and `memberships`, never inferred from
 * the role.
 */
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
  /**
   * Module roles and per-assignment roles, as membership rows (§2). Empty
   * arrays throughout for someone who holds none.
   */
  memberships: {
    cl_admin_assignments: number[];
    cl_imp_assignments: number[];
    attendance_configs: number[];
    inventory_outlets: number[];
    spot_check_outlets: number[];
  };
};

/**
 * PATCH /auth/me — §2: change own interface_language. Nothing else on the
 * identity is self-editable (no email, no name, no password).
 */
export type UpdateMeRequest = {
  interface_language: MeResponse['user']['interface_language'];
};
