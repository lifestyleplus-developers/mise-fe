import type {
  CreateSpotCheckRequest,
  SpotCheck,
  SpotCheckRecurrence,
  SpotCheckSubjectType,
} from '@/shared/api/types';

/** The window a check can have, in minutes (Spot Checks §2), changed in steps of five. */
export const MIN_REVEAL_WINDOW = 15;
export const MAX_REVEAL_WINDOW = 30;
export const REVEAL_WINDOW_STEP = 5;

/** Spot checks repeat daily, weekly or monthly. The mockup's Hourly is dropped: the Schema has no interval for it. */
export const CHECK_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

/** A prompt or an item in the editor. `weight` means nothing on a prompt. */
export type DraftRow = {
  /** Stable while editing; moves with the row when it is reordered. */
  key: string;
  text: string;
  weight: number;
  /** Archived in this editor: hidden, and removed or flagged on Save. */
  archived: boolean;
  /** It was already on the platform, so archiving it has to be told to it. */
  saved: boolean;
};

export type CheckForm = {
  name: string;
  subject: SpotCheckSubjectType;
  recurrence: SpotCheckRecurrence;
  weekdays: number[];
  /** Day of the month, for Monthly. */
  day: number;
  /** HH:MM, or empty until chosen. */
  start: string;
  window: number;
  prompts: DraftRow[];
  items: DraftRow[];
};

export const DEFAULT_WEIGHT = 5;

export const EMPTY_CHECK_FORM: CheckForm = {
  name: '',
  subject: 'STAFF',
  recurrence: 'DAILY',
  weekdays: [],
  day: 1,
  start: '',
  window: 20,
  prompts: [],
  items: [],
};

let sequence = 0;
/** A key for a row made in this editor. */
export function newRowKey(): string {
  sequence += 1;
  return `new-${sequence}`;
}

export function formFromCheck(check: SpotCheck): CheckForm {
  return {
    name: check.name,
    subject: check.subject_type,
    recurrence: check.recurrence,
    weekdays: [...(check.weekdays ?? [])].sort((a, b) => a - b),
    day: check.day_of_month ?? 1,
    start: check.st_time,
    window: check.reveal_window_minutes,
    prompts: check.captures.map((capture) => ({
      key: `p${capture.position}`,
      text: capture.prompt,
      weight: DEFAULT_WEIGHT,
      archived: false,
      saved: true,
    })),
    items: check.assertions.map((item) => ({
      key: `i${item.position}`,
      text: item.text,
      weight: item.weight,
      archived: item.is_archived,
      saved: true,
    })),
  };
}

/** The rows the editor shows: archived ones are hidden. */
export function liveRows(rows: readonly DraftRow[]): DraftRow[] {
  return rows.filter((row) => !row.archived);
}

/** Save is on with a name, a selection time and at least one prompt; the platform judges the rest. */
export function canSaveCheck(form: CheckForm): boolean {
  return (
    form.name.trim().length > 0 &&
    form.start !== '' &&
    liveRows(form.prompts).length > 0
  );
}

/**
 * Moves a row one place up (-1) or down (+1) among the rows that are shown,
 * stepping over archived ones. At either end nothing moves.
 */
export function moveRow(
  rows: readonly DraftRow[],
  key: string,
  direction: -1 | 1,
): DraftRow[] {
  const visible = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.archived);
  const at = visible.findIndex(({ row }) => row.key === key);
  const to = at + direction;
  if (at < 0 || to < 0 || to >= visible.length) return [...rows];
  const next = [...rows];
  const a = visible[at].index;
  const b = visible[to].index;
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/**
 * What goes to the platform, in the order shown. A prompt archived here is simply
 * left out. An item archived here is sent flagged if the platform already has it,
 * and left out if it was made and archived in this same editor.
 */
export function toCheckRequest(
  form: CheckForm,
): Omit<CreateSpotCheckRequest, 'outlet_id'> {
  return {
    name: form.name.trim(),
    subject_type: form.subject,
    recurrence: form.recurrence,
    st_time: form.start,
    weekdays: form.recurrence === 'WEEKLY' ? form.weekdays : null,
    day_of_month: form.recurrence === 'MONTHLY' ? form.day : null,
    reveal_window_minutes: form.window,
    captures: liveRows(form.prompts).map((row) => ({
      prompt: row.text.trim(),
    })),
    assertions: form.items
      .filter((row) => !row.archived || row.saved)
      .map((row) => ({
        text: row.text.trim(),
        weight: row.weight,
        is_archived: row.archived,
      })),
  };
}

/**
 * The form with nothing that only identifies a row, for comparing "as loaded" with
 * "as it stands now" (`useUnsavedChanges`): same shape, same order, no keys.
 */
export function normalizeCheckForm(form: CheckForm) {
  const rows = (list: readonly DraftRow[]) =>
    list.map((row) => ({
      text: row.text.trim(),
      weight: row.weight,
      archived: row.archived,
    }));
  return {
    name: form.name.trim(),
    subject: form.subject,
    recurrence: form.recurrence,
    weekdays: form.recurrence === 'WEEKLY' ? [...form.weekdays].sort() : [],
    day: form.recurrence === 'MONTHLY' ? form.day : 0,
    start: form.start,
    window: form.window,
    prompts: rows(form.prompts),
    items: rows(form.items),
  };
}

/** Steps the reveal window by one step, staying inside 15 to 30. */
export function stepWindow(window: number, direction: -1 | 1): number {
  return Math.min(
    MAX_REVEAL_WINDOW,
    Math.max(MIN_REVEAL_WINDOW, window + direction * REVEAL_WINDOW_STEP),
  );
}
