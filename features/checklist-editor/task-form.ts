import type {
  CreateTaskRequest,
  Task,
  UpdateTaskRequest,
} from '@/shared/api/types';

export type AnswerType = Task['answer_type'];

/** The task sheet's form. Limits stay text while typed, so "4." and "-" are allowed. */
export type TaskForm = {
  type: AnswerType | null;
  text: string;
  unit: string;
  min: string;
  max: string;
  weight: number;
};

export const DEFAULT_WEIGHT = 5;

export const EMPTY_TASK_FORM: TaskForm = {
  type: null,
  text: '',
  unit: '',
  min: '',
  max: '',
  weight: DEFAULT_WEIGHT,
};

export function formFromTask(task: Task): TaskForm {
  return {
    type: task.answer_type,
    text: task.text,
    unit: task.unit ?? '',
    min: task.min_value === null ? '' : String(task.min_value),
    max: task.max_value === null ? '' : String(task.max_value),
    weight: task.weight,
  };
}

/** A typed limit as a number: blank is none, a comma counts as a point. */
export function parseLimit(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return Number(trimmed.replace(',', '.'));
}

/** True when something is typed that is not a number. */
export function isBadLimit(value: string): boolean {
  return value.trim() !== '' && !Number.isFinite(parseLimit(value));
}

export type TaskProblems = {
  type: boolean;
  text: boolean;
  badMin: boolean;
  badMax: boolean;
  /** Both limits are numbers and the lowest is not below the highest. */
  bounds: boolean;
};

export function checkTaskForm(form: TaskForm): TaskProblems {
  const reading = form.type === 'NUMBER';
  const badMin = reading && isBadLimit(form.min);
  const badMax = reading && isBadLimit(form.max);
  const min = badMin ? null : parseLimit(form.min);
  const max = badMax ? null : parseLimit(form.max);
  return {
    type: form.type === null,
    text: !form.text.trim(),
    badMin,
    badMax,
    bounds: reading && min !== null && max !== null && !(min < max),
  };
}

export const hasTaskProblems = (problems: TaskProblems) =>
  Object.values(problems).some(Boolean);

/** Whether the task can fail: a Yes/No can; a reading only with a limit. */
export function canFail(form: TaskForm): boolean {
  if (form.type === 'BINARY') return true;
  if (form.type !== 'NUMBER') return false;
  return parseLimit(form.min) !== null || parseLimit(form.max) !== null;
}

/** The fields a reading needs, null for the other types. Only call on a sound form. */
function readingFields(form: TaskForm) {
  const reading = form.type === 'NUMBER';
  return {
    unit: reading && form.unit.trim() ? form.unit.trim() : null,
    min_value: reading ? parseLimit(form.min) : null,
    max_value: reading ? parseLimit(form.max) : null,
  };
}

export function toCreateRequest(form: TaskForm): CreateTaskRequest {
  return {
    answer_type: form.type ?? 'BINARY',
    text: form.text.trim(),
    weight: form.weight,
    ...readingFields(form),
  };
}

export function toUpdateRequest(form: TaskForm): UpdateTaskRequest {
  return {
    text: form.text.trim(),
    weight: form.weight,
    ...readingFields(form),
  };
}

/** Shown with the real minus sign, which is easier to see than a hyphen. */
export function showNumber(value: number | string | null): string {
  return value === null ? '' : String(value).replace('-', '−');
}

/** Keeps what can belong in a limit: digits, one point or comma, a leading minus. */
export function cleanLimitInput(input: string): string {
  const stripped = input.replace(/−/g, '-').replace(/[^0-9.,-]/g, '');
  return (stripped.startsWith('-') ? '-' : '') + stripped.replace(/-/g, '');
}

/** Flips a limit between negative and positive; the sign button on the field. */
export function flipSign(value: string): string {
  return value.startsWith('-') ? value.slice(1) : `-${value}`;
}
