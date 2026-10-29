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
  COMMENT_REQUIRED_ON_FAILURE: 'comment_required_on_failure',
  WINDOW_CLOSED: 'window_closed',
  SUPERVISORS_CANNOT_ANSWER: 'supervisors_cannot_answer',
  AUTHORING_FORBIDDEN: 'authoring_forbidden',
  NOT_YOUR_ASSIGNMENT: 'not_your_assignment',
  NOT_FOUND: 'not_found',
  ROLE_CONFLICT: 'role_conflict',
  WINDOW_OVERLAPS_NEXT_PERIOD: 'window_overlaps_next_period',
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

/**
 * POST /auth/login → 409 `ambiguous_username` — §2: the businesses sit inside
 * the error, as `error.businesses`.
 */
export type AmbiguousUsernameBody = ApiErrorBody & {
  error: { businesses: BusinessRef[] };
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
    tenant_role: Role;
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
  tenant_role: Role;
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
  tenant_role: Role;
};

/** PATCH /users/{id}. */
export type UpdateUserRequest = Partial<
  Pick<User, 'full_name' | 'tenant_role' | 'is_active'>
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
  /** HOURLY only: a run every this many hours (1–3), from `st_time` to `last_run_time`. */
  interval_hours: number | null;
  /** HOURLY only: HH:MM, the last run of each day. */
  last_run_time: string | null;
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
  /**
   * Counts the admin list (CHK-10) shows. Not in the contract yet, so both are
   * optional and the list must read fine without them.
   */
  task_count?: number;
  outlet_count?: number;
};

/** API Contract §5 — a task on the authored checklist (not a run's snapshot). */
export type Task = {
  id: number;
  position: number;
  answer_type: 'BINARY' | 'NUMBER' | 'IMAGE';
  text: string;
  /** NUMBER only. */
  unit: string | null;
  /** NUMBER only; either bound may be set alone, neither means log-only. */
  min_value: number | null;
  max_value: number | null;
  requires_comment_on_fail: boolean;
  /** 1–10, default 5. */
  weight: number;
};

/** GET /checklists/{id} — the checklist with its tasks, in order. */
export type ChecklistDetail = Checklist & { tasks: Task[] };

/** POST /checklists. weekdays is WEEKLY only, day_of_month MONTHLY only. */
export type CreateChecklistRequest = Pick<
  Checklist,
  'name' | 'recurrence' | 'st_time' | 'deadline_minutes'
> &
  Partial<
    Pick<
      Checklist,
      'weekdays' | 'day_of_month' | 'interval_hours' | 'last_run_time'
    >
  >;

/** PATCH /checklists/{id} — name and schedule. */
export type UpdateChecklistRequest = Partial<CreateChecklistRequest>;

/**
 * POST /checklists/{id}/tasks. The type is fixed once the task exists.
 * `requires_comment_on_fail` is not sent: the platform works it out from the
 * answer type and refuses it as a field it cannot write (400).
 */
export type CreateTaskRequest = Pick<Task, 'answer_type' | 'text'> &
  Partial<Pick<Task, 'unit' | 'min_value' | 'max_value' | 'weight'>>;

/** PATCH /tasks/{id}. */
export type UpdateTaskRequest = Partial<Omit<CreateTaskRequest, 'answer_type'>>;

/** POST /checklists/{id}/tasks/reorder. */
export type ReorderTasksRequest = { task_ids: number[] };

/** Someone who was still on an assignment when it was switched back on. */
export type ReturningMember = {
  user_id: number;
  full_name: string;
  role: 'CL_ADMIN' | 'CL_IMP';
};

/**
 * GET /checklists/{id}/assignments — one outlet a checklist runs, or ran, at.
 * An inactive row is history: no further runs, and its people are kept.
 */
export type OutletAssignment = {
  id: number;
  checklist_id: number;
  outlet: { id: number; name: string };
  is_active: boolean;
  /**
   * Only on the answer to POST /checklists/{id}/assignments, and only on a row that
   * call switched back on: the people who came back with it. Empty otherwise.
   */
  returning_members?: ReturningMember[];
};

/** POST /checklists/{id}/assignments — bulk. */
export type CreateAssignmentsRequest = { outlet_ids: number[] };

export type AssignmentRole = 'CL_ADMIN' | 'CL_IMP';

/** One person in a bucket of GET /assignments/{id}/members. */
export type TeamPerson = {
  id: number;
  username: string;
  full_name: string;
  /** False for a deactivated account that is still on the assignment. */
  is_active: boolean;
};

/** GET /assignments/{id}/candidates — active, and not on the assignment yet. */
export type Candidate = {
  id: number;
  username: string;
  full_name: string;
};

/** GET /assignments/{id}/candidates filters. */
export type CandidatesQuery = {
  page: number;
  pageSize: number;
  search?: string;
};

/** Someone taken off an assignment: who they were, and when and by whom. */
export type RemovedTeamPerson = TeamPerson & {
  role: AssignmentRole;
  removed_at: string;
  removed_by: { id: number; full_name: string } | null;
};

/**
 * GET /assignments/{id}/members — both buckets, each by username. Someone taken
 * off is not deleted: `removed` lists them, latest first, and is present only
 * with `?include_removed=true`.
 */
export type Team = {
  cl_admins: TeamPerson[];
  cl_imps: TeamPerson[];
  removed?: RemovedTeamPerson[];
};

/**
 * One person on a team as the screens use them: a `Team` flattened, with the
 * role of the bucket they were in. Built in `features/assignments/team.ts`; the
 * platform never sends this shape.
 */
export type AssignmentMember = {
  user_id: number;
  username: string;
  full_name: string;
  role: AssignmentRole;
  is_active: boolean;
  removed_at: string | null;
  removed_by: { id: number; full_name: string } | null;
};

/** POST /assignments/{id}/members. */
export type AddMemberRequest = { user_id: number; role: AssignmentRole };

/** API Contract §7 — one task inside a run: the snapshot plus its answer. */
export type RunTask = {
  id: number;
  position: number;
  answer_type: 'BINARY' | 'NUMBER' | 'IMAGE';
  text: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  weight: number;
  requires_comment_on_fail: boolean;
  answer_number: number | null;
  answer_bool: boolean | null;
  image_key: string | null;
  image_url: string | null;
  comment: string | null;
  outcome: 'PASS' | 'FAIL' | 'MISSED' | 'PENDING_JUDGEMENT' | null;
  /**
   * The AI's reason for an image verdict. Not in API Contract §7 yet: the mock
   * sends it, and the real platform must be asked to before this is relied on.
   */
  ai_comment?: string | null;
  answered_by: { id: number; full_name: string } | null;
  answered_at: string | null;
};

/** GET /runs/{id} — the run as Home lists it, plus its tasks. */
export type RunDetail = Run & {
  tasks: RunTask[];
};

/**
 * PATCH /run-tasks/{id} — §7. Send only the field for the task's type:
 * `answer_bool` for a binary, `answer_number` for a reading, `image_key` for
 * a photo. Comment is required whenever the written answer fails and the
 * task asks for one (`comment_required_on_failure`, 400).
 */
export type AnswerTaskRequest = {
  answer_bool?: boolean;
  answer_number?: number;
  image_key?: string;
  comment?: string | null;
};

/**
 * POST /uploads/sign — §8. The photograph never passes through the platform:
 * sign, PUT the bytes to object storage, then PATCH the run task with the key.
 */
export type UploadSignRequest = {
  purpose: 'run_task';
  target_id: number;
  content_type: 'image/jpeg';
};

/** → 200. */
export type UploadSignResponse = {
  upload_url: string;
  method: 'PUT';
  headers: Record<string, string>;
  key: string;
};
