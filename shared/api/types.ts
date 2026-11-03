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
  PERMISSION_DENIED: 'permission_denied',
  UNIT_LOCKED: 'unit_locked',
  OVERRIDE_NOTE_REQUIRED: 'override_note_required',
  WINDOW_NOT_OPEN: 'window_not_open',
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
 * GET /checklists row: the checklist plus `assignments`, the active outlets it
 * runs at that the caller can see (FE Spec §3.4), each with the caller's part
 * there. `score` is null until a period has closed and reporting exists.
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

/** API Contract §11 — where a person on the roster is enrolled. */
export type StaffOutlet = {
  outlet_id: number;
  /** False once they have been taken off that outlet's list; the row stays. */
  is_active: boolean;
};

/**
 * A person who needs attendance recorded. Not a user: no login, never in /users.
 * `outlets` holds only the outlets the caller may see.
 */
export type Staff = {
  id: number;
  full_name: string;
  staff_code: string | null;
  is_archived: boolean;
  outlets: StaffOutlet[];
};

/** GET /staff filters. `outletId` lists people active there; archived ones are opt-in. */
export type StaffQuery = {
  page: number;
  pageSize: number;
  outletId?: number;
  search?: string;
  includeArchived?: boolean;
};

/** POST /staff. A manager must give `outlet_ids`; an ADMIN or OWNER may enrol later. */
export type CreateStaffRequest = {
  full_name: string;
  staff_code?: string | null;
  outlet_ids?: number[];
};

/** PATCH /staff/{id} — name, code, archive. */
export type UpdateStaffRequest = Partial<
  Pick<Staff, 'full_name' | 'staff_code' | 'is_archived'>
>;

/** POST /staff/{id}/outlets — enrol, or set whether they are active there. */
export type EnrolStaffRequest = { outlet_id: number; is_active?: boolean };

/** Someone appointed to mark a configuration. */
export type AttendanceManager = {
  id: number;
  username: string;
  full_name: string;
};

/**
 * API Contract §11 — one attendance schedule at an outlet. An outlet may have
 * several (shifts). Never HOURLY: the platform refuses it (400 on `recurrence`).
 */
export type AttendanceConfig = {
  id: number;
  outlet_id: number;
  name: string;
  /** Phase 1 offers MANUAL only. */
  method: 'MANUAL';
  recurrence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  /** HH:MM, business-local. */
  st_time: string;
  deadline_minutes: number;
  /** WEEKLY only; 1 = Monday … 7 = Sunday. */
  weekdays: number[] | null;
  /** MONTHLY only. */
  day_of_month: number | null;
  is_archived: boolean;
  managers: AttendanceManager[];
};

/** GET /attendance/configs filters. */
export type AttendanceConfigsQuery = {
  page: number;
  pageSize: number;
  outletId?: number;
  includeArchived?: boolean;
};

/** POST /attendance/configs. `weekdays` is WEEKLY only, `day_of_month` MONTHLY only. */
export type CreateAttendanceConfigRequest = Pick<
  AttendanceConfig,
  'outlet_id' | 'name' | 'recurrence' | 'st_time' | 'deadline_minutes'
> &
  Partial<Pick<AttendanceConfig, 'method' | 'weekdays' | 'day_of_month'>>;

/** PATCH /attendance/configs/{id} — everything but the outlet. */
export type UpdateAttendanceConfigRequest = Partial<
  Omit<CreateAttendanceConfigRequest, 'outlet_id'>
>;

/** POST /attendance/configs/{id}/managers. */
export type AppointManagerRequest = { user_id: number };

export type AttendanceMarkStatus =
  'UNMARKED' | 'PRESENT' | 'NOT_PRESENT' | 'NEEDS_REVIEW';

/** One kept correction on a mark, oldest first. */
export type AttendanceMarkChange = {
  from_status: AttendanceMarkStatus;
  to_status: AttendanceMarkStatus;
  changed_by: number;
  changed_at: string;
};

/**
 * API Contract §11 — one person's mark in one session, with its history.
 * NOT_PRESENT from `SYSTEM` means nobody marked them; from `MANUAL`, a manager
 * said they were absent. UNMARKED exists only while the session is OPEN.
 */
export type AttendanceMark = {
  id: number;
  staff: { id: number; full_name: string; staff_code: string | null };
  status: AttendanceMarkStatus;
  source: 'MANUAL' | 'RECOGNISED' | 'SYSTEM';
  confidence: number | null;
  note: string | null;
  marked_by: { id: number; full_name: string } | null;
  marked_at: string | null;
  changes: AttendanceMarkChange[];
};

/** `not_present` is a manager saying absent; `not_marked` is nobody checking. */
export type AttendanceCounts = {
  total: number;
  present: number;
  not_present: number;
  not_marked: number;
  needs_review: number;
  /** Open sessions only. */
  unmarked: number;
};

/** A session in a list: where, when, and how far marking has got. */
export type AttendanceSession = {
  id: number;
  config_id: number;
  config_name: string;
  outlet_id: number;
  outlet_name: string;
  method: 'MANUAL';
  status: 'OPEN' | 'FINALIZED';
  window_open: string;
  window_close: string;
  finalized_at: string | null;
  counts: AttendanceCounts;
};

/** GET /attendance/sessions/{id} — with the roster snapshot, by name. */
export type AttendanceSessionDetail = AttendanceSession & {
  marks: AttendanceMark[];
};

/** GET /attendance/sessions filters. `from`/`to` are dates (YYYY-MM-DD), both inclusive. */
export type AttendanceSessionsQuery = {
  page: number;
  pageSize: number;
  outletId?: number;
  state?: 'open' | 'upcoming' | 'closed';
  from?: string;
  to?: string;
};

/**
 * PATCH /attendance/marks/{id}. A manager sets PRESENT or NOT_PRESENT only; a mark
 * cannot be put back to unmarked. `note` left out stays, null clears it.
 */
export type MarkPersonRequest = {
  status: 'PRESENT' | 'NOT_PRESENT';
  note?: string | null;
};

export type InventoryUnit = 'KG' | 'G' | 'L' | 'ML' | 'COUNT';

/** API Contract §12. `balance` can go below zero. */
export type InventoryItem = {
  id: number;
  outlet_id: number;
  name: string;
  /** Exactly one; immutable once movements exist (409 `unit_locked`). */
  unit: InventoryUnit;
  reference_price: number | null;
  balance: number;
  is_archived: boolean;
};

/** GET /inventory/items filters. */
export type InventoryItemsQuery = {
  page: number;
  pageSize: number;
  outletId?: number;
  search?: string;
  includeArchived?: boolean;
};

/** POST /inventory/items. */
export type CreateInventoryItemRequest = {
  outlet_id: number;
  name: string;
  unit: InventoryUnit;
  reference_price?: number | null;
};

/** PATCH /inventory/items/{id} — name, reference price, archive; the unit until movements exist. */
export type UpdateInventoryItemRequest = Partial<
  Pick<InventoryItem, 'name' | 'unit' | 'reference_price' | 'is_archived'>
>;

export type InventoryMovementKind = 'ADD' | 'REMOVE' | 'COUNT';

/**
 * API Contract §12 — one append-only entry. On a COUNT, `quantity` is the observed
 * total, not a delta: below the balance sets `derived_out`, above it `derived_in`
 * (stock that arrived unrecorded — information, not an error).
 */
export type InventoryMovement = {
  id: number;
  item_id: number;
  kind: InventoryMovementKind;
  quantity: number;
  /** ADD only. */
  unit_price: number | null;
  note: string | null;
  derived_out: number | null;
  derived_in: number | null;
  balance_after: number;
  recorded_by: { id: number; full_name: string };
  recorded_at: string;
};

/** POST /inventory/items/{id}/movements. `unit_price` is for an ADD. */
export type RecordMovementRequest = {
  kind: InventoryMovementKind;
  quantity: number;
  unit_price?: number | null;
  note?: string | null;
};

/**
 * The movement log across an outlet's items, newest first. The contract has the
 * ledger per item only; INV-03 filters by item, so `itemId` is optional here and
 * the real endpoint will need an outlet-wide form. `from`/`to` are dates.
 */
export type InventoryMovementsQuery = {
  page: number;
  pageSize: number;
  outletId?: number;
  itemId?: number;
  from?: string;
  to?: string;
};

/**
 * The three report shapes are not in the API Contract yet; they follow the
 * mockup (INV-04) and move when Lifestyle's endpoints land.
 */
export type StockOnHandReport = {
  outlet_id: number;
  as_of: string;
  items: {
    item_id: number;
    name: string;
    unit: InventoryUnit;
    balance: number;
  }[];
};

/** `in` includes stock that arrived unrecorded (a COUNT above the balance). */
export type StockSummaryReport = {
  outlet_id: number;
  from: string;
  to: string;
  items: {
    item_id: number;
    name: string;
    unit: InventoryUnit;
    opening: number;
    in: number;
    out: number;
    closing: number;
  }[];
};

/** Spend in rupees: only deliveries (ADD) that carried a unit price count. */
export type StockSpendReport = {
  outlet_id: number;
  from: string;
  to: string;
  total: number;
  items: {
    item_id: number;
    name: string;
    unit: InventoryUnit;
    quantity: number;
    amount: number;
  }[];
};

/** GET /inventory/reports/* filters. */
export type StockReportQuery = {
  outletId: number;
  from?: string;
  to?: string;
};

/**
 * Someone who records stock at an outlet. API Contract §12 has no endpoint for
 * appointing them yet, so this shape belongs to the mock until Lifestyle adds one.
 */
export type InventoryManager = {
  id: number;
  username: string;
  full_name: string;
};

// ---------------------------------------------------------------------------
// Week 9 — spot checks (API Contract §13). Marked "mock only" where the contract
// has no endpoint or field yet; those move when Lamax's platform lands.
// ---------------------------------------------------------------------------

/** An inspectable part of an outlet (Schema `area`). Mock only: API Contract §13 has no endpoint for areas. */
export type Area = {
  id: number;
  outlet_id: number;
  name: string;
  /** Whether it may be picked for a spot check. */
  is_eligible: boolean;
  is_archived: boolean;
};

/** GET areas filters. */
export type AreasQuery = {
  outletId?: number;
  includeArchived?: boolean;
  page: number;
  pageSize: number;
};

/** POST an area. A name already used at the outlet is a 400 `validation_error` on `name` (Schema: `unique(outlet_id, name)`). */
export type CreateAreaRequest = {
  outlet_id: number;
  name: string;
  is_eligible?: boolean;
};

/** PATCH an area: rename, switch eligibility, archive. */
export type UpdateAreaRequest = Partial<
  Pick<Area, 'name' | 'is_eligible' | 'is_archived'>
>;

export type SpotCheckSubjectType = 'STAFF' | 'AREA';

/** As `checklist.recurrence`, never HOURLY for a spot check. */
export type SpotCheckRecurrence = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** What the manager is told to photograph, in order. */
export type SpotCheckCapture = {
  position: number;
  prompt: string;
};

/**
 * What gets judged. 🔒 Never mapped to a capture: every assertion is judged against
 * the whole set. `is_archived` is mock only.
 */
export type SpotCheckAssertion = {
  position: number;
  text: string;
  /** 1–10, default 5. */
  weight: number;
  is_archived: boolean;
};

/** The template (Schema `spot_check`), with its prompts and items. */
export type SpotCheck = {
  id: number;
  outlet_id: number;
  name: string;
  subject_type: SpotCheckSubjectType;
  recurrence: SpotCheckRecurrence;
  /** `HH:MM`: when selection happens. */
  st_time: string;
  /** ISO weekdays 1–7, for WEEKLY; null otherwise. */
  weekdays: number[] | null;
  day_of_month: number | null;
  /** 15–30: reveal to deadline. */
  reveal_window_minutes: number;
  is_archived: boolean;
  captures: SpotCheckCapture[];
  assertions: SpotCheckAssertion[];
};

/** GET /spot-checks filters. */
export type SpotChecksQuery = {
  outletId?: number;
  includeArchived?: boolean;
  page: number;
  pageSize: number;
};

/** POST /spot-checks. Prompts and items go in with their own calls. */
export type CreateSpotCheckRequest = Pick<
  SpotCheck,
  | 'outlet_id'
  | 'name'
  | 'subject_type'
  | 'recurrence'
  | 'st_time'
  | 'weekdays'
  | 'day_of_month'
  | 'reveal_window_minutes'
>;

/** PATCH /spot-checks/{id}: everything but the outlet; archive. */
export type UpdateSpotCheckRequest = Partial<
  Omit<CreateSpotCheckRequest, 'outlet_id'> & Pick<SpotCheck, 'is_archived'>
>;

/** POST /spot-checks/{id}/captures. Editing or removing a prompt is mock only. */
export type SpotCheckCaptureRequest = { prompt: string };

/** POST /spot-checks/{id}/assertions. Editing or archiving an item is mock only. */
export type SpotCheckAssertionRequest = {
  text?: string;
  weight?: number;
  is_archived?: boolean;
};

/** Who takes spot checks at an outlet. Mock only: no table or endpoint yet (Known Inconsistency #7). */
export type SpotCheckManager = {
  id: number;
  username: string;
  full_name: string;
};

/** A captured photograph; `captured_at` is set by the server. */
export type SpotCheckPhoto = {
  captured_at: string;
  /** Null once purged under the retention policy. */
  image_url: string | null;
  purged_at: string | null;
  captured_by: { id: number; full_name: string };
};

/** One prompt of a revealed run and its photograph, if sent. */
export type SpotCheckRunCapture = SpotCheckCapture & {
  photo: SpotCheckPhoto | null;
  /** Mock only: photos this one replaced on a retake, oldest first, each kept with its time. */
  earlier_photos: SpotCheckPhoto[];
};

export type SpotCheckOutcome =
  'PASS' | 'FAIL' | 'NEEDS_REVIEW' | 'PENDING_JUDGEMENT';

/** One row per assertion. 🔒 The original `outcome` is never overwritten by an override. */
export type SpotCheckResult = {
  id: number;
  assertion_position: number;
  /** Copied at creation: the snapshot. */
  assertion_text: string;
  outcome: SpotCheckOutcome;
  confidence: number | null;
  overridden_to: SpotCheckOutcome | null;
  override_note: string | null;
  overridden_by: { id: number; full_name: string } | null;
  /** Mock only: the Schema has no override time. */
  overridden_at: string | null;
};

/**
 * `SCHEDULED` is a run before reveal; `FINALIZED` is closed. The contract returns
 * the first two; the Schema has `OPEN | FINALIZED` (Known Inconsistency #5).
 */
export type SpotCheckRunStatus = 'SCHEDULED' | 'OPEN' | 'FINALIZED';

/** How a closed run ended. Mock only: the Schema has no missed status (Known Inconsistency #5). */
export type SpotCheckCompletion = 'DONE' | 'PARTIAL' | 'NOT_DONE';

/**
 * 🔒 `subject`, `revealed_at` and `window_close` are null until the reveal: nothing
 * else in the payload may give the subject away.
 */
export type SpotCheckRun = {
  id: number;
  spot_check_id: number;
  spot_check_name: string;
  outlet_id: number;
  status: SpotCheckRunStatus;
  subject:
    | { type: 'STAFF'; id: number; full_name: string }
    | { type: 'AREA'; id: number; name: string }
    | null;
  revealed_at: string | null;
  window_close: string | null;
  /** Mock only: when the check is selected, shown before reveal without the subject. */
  scheduled_for: string;
  /** The manager the subject was revealed to. */
  manager: { id: number; full_name: string } | null;
  captures: SpotCheckRunCapture[] | null;
  /** Null while the run is open or scheduled. */
  completion: SpotCheckCompletion | null;
  /** Null when the caller may not see this run's outcomes (another manager's). */
  results: SpotCheckResult[] | null;
  /** Mock only: the issue a failure raised (Known Inconsistency #6). */
  issue_id: number | null;
};

/** GET /spot-check-runs filters. `closed` and `outcome` are mock only. */
export type SpotCheckRunsQuery = {
  state?: 'revealed' | 'scheduled' | 'closed';
  outletId?: number;
  outcome?: SpotCheckOutcome;
  page: number;
  pageSize: number;
};

/** POST /spot-check-runs/{id}/photos. A late photo is a 409 `window_closed`; a retake replaces the photo for that prompt. */
export type SubmitSpotCheckPhotoRequest = {
  capture_position: number;
  image_key: string;
};

/** PATCH /spot-check-results/{id}. `override_note` is required (400 without). */
export type OverrideSpotCheckResultRequest = {
  overridden_to: Exclude<SpotCheckOutcome, 'PENDING_JUDGEMENT'>;
  override_note: string;
};
