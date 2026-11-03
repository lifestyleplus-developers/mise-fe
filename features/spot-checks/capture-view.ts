import { ApiError } from '@/shared/api/client';
import type {
  SpotCheckCompletion,
  SpotCheckRun,
  SpotCheckRunCapture,
} from '@/shared/api/types';

import type { PhotoLine } from './prompt-row';
import type { PromptState } from './prompt-state';

/** What the Spot checks entry shows when nothing was asked for by link. */
export type LandingKind = 'run' | 'list' | 'scheduled' | 'noChecks' | 'empty';

type LandingInput = {
  revealed: number;
  scheduled: number;
  /** ADMIN or OWNER: the only ones who can set checks up. */
  admin: boolean;
  /** Live checks across the outlets this person can read. */
  checkCount: number;
};

/**
 * One revealed check is shown at once; two or more are a list; none is the next
 * one scheduled (never its subject), or nothing. Head office with no checks at all
 * is told so, with the way to set them up.
 */
export function landingKind({
  revealed,
  scheduled,
  admin,
  checkCount,
}: LandingInput): LandingKind {
  if (revealed === 1) return 'run';
  if (revealed > 1) return 'list';
  if (scheduled > 0) return 'scheduled';
  return admin && checkCount === 0 ? 'noChecks' : 'empty';
}

export type ClosedSummary =
  | { kind: 'done' }
  | { kind: 'none' }
  | { kind: 'partial'; sent: number; total: number };

/**
 * How a closed run ended, in the card's words. The platform's own answer
 * (`completion`) wins once it has one; before that, what the phone can see: the
 * photographs that are in.
 */
export function closedSummary(input: {
  completion: SpotCheckCompletion | null;
  sent: number;
  total: number;
}): ClosedSummary {
  const { completion, sent, total } = input;
  const by =
    completion ?? (sent === 0 ? 'NOT_DONE' : sent < total ? 'PARTIAL' : 'DONE');
  if (by === 'NOT_DONE') return { kind: 'none' };
  if (by === 'PARTIAL') return { kind: 'partial', sent, total };
  return { kind: 'done' };
}

/** How many prompts of a run have a photograph the platform holds. */
export function sentCount(captures: readonly SpotCheckRunCapture[]): number {
  return captures.filter((capture) => capture.photo !== null).length;
}

/** The first prompt still to take, not counting `except` (the one just sent). */
export function nextToTake(
  captures: readonly SpotCheckRunCapture[],
  states: Readonly<Record<number, PromptState>>,
  except?: number,
): SpotCheckRunCapture | undefined {
  return captures.find(
    (capture) =>
      capture.position !== except && states[capture.position] === 'toTake',
  );
}

/** How many prompts are waiting to be sent. */
export function waitingCount(
  states: Readonly<Record<number, PromptState>>,
): number {
  return Object.values(states).filter((state) => state === 'waiting').length;
}

type LineText = {
  /** "{name} {time}" */
  byAt: (name: string, time: string) => string;
  /** "New photo · {name} {time}" */
  newPhoto: (name: string, time: string) => string;
  /** "Replaced · {name} {time}" */
  replaced: (name: string, time: string) => string;
  /** An ISO moment as the phone's clock shows it. */
  time: (iso: string) => string;
};

/**
 * The lines under a prompt about its photograph: who took it and when. After a
 * retake there are two, the new one and, quieter, the one it replaced; both stay.
 */
export function photoLinesFor(
  capture: SpotCheckRunCapture,
  text: LineText,
): PhotoLine[] {
  const photo = capture.photo;
  if (!photo) return [];
  const earlier = capture.earlier_photos[capture.earlier_photos.length - 1];
  const taken = (shot: typeof photo) => ({
    name: shot.captured_by.full_name,
    time: text.time(shot.captured_at),
  });
  if (!earlier) {
    const { name, time } = taken(photo);
    return [{ text: text.byAt(name, time), uri: photo.image_url }];
  }
  const now = taken(photo);
  const before = taken(earlier);
  return [
    { text: text.newPhoto(now.name, now.time), uri: photo.image_url },
    {
      text: text.replaced(before.name, before.time),
      muted: true,
      uri: earlier.image_url,
    },
  ];
}

/**
 * Why the platform refused a photograph: the window had closed (it will show as
 * missed), the role is gone, or something else.
 */
export type RefusalKind = 'closed' | 'forbidden' | 'other';

export function refusalKind(error: ApiError | null): RefusalKind {
  if (!error) return 'other';
  if (error.status === 409) return 'closed';
  if (error.status === 403) return 'forbidden';
  return 'other';
}

/** Whether the run is still taking photographs, by the clock as well as by its status. */
export function runIsOpen(
  run: Pick<SpotCheckRun, 'status' | 'window_close'>,
  now: number,
): boolean {
  return (
    run.status === 'OPEN' &&
    run.window_close !== null &&
    now < new Date(run.window_close).getTime()
  );
}
