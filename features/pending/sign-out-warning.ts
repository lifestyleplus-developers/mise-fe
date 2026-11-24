import { format, type MessageKey } from '@/shared/i18n';

import {
  WRITE_KIND,
  type PendingWrites,
  type WriteKind,
} from './use-pending-writes';

/** Which wording names a single kind. Issue resolves read as "changes". */
const SINGLE: Record<
  WriteKind,
  'answers' | 'photos' | 'marks' | 'stock' | 'changes'
> = {
  [WRITE_KIND.ANSWER]: 'answers',
  [WRITE_KIND.PHOTO]: 'photos',
  [WRITE_KIND.MARK]: 'marks',
  [WRITE_KIND.STOCK]: 'stock',
  [WRITE_KIND.RESOLVE]: 'changes',
};

/** Kinds whose work is lost for good, not just late, if a window closes first. */
const WINDOWED: WriteKind[] = [
  WRITE_KIND.ANSWER,
  WRITE_KIND.MARK,
  WRITE_KIND.PHOTO,
];

/**
 * What the sign-out dialog says about work that has not been sent (FE Spec §6:
 * queued writes do not survive sign-out, so warn first). One kind is named; several
 * are totalled, and the total says a window may close first when any of them
 * has one. Null when nothing is waiting.
 */
export function signOutWarning(
  work: PendingWrites,
  t: (key: MessageKey) => string,
): string | null {
  if (work.total === 0) return null;
  const n = String(work.total);
  if (work.kinds.length === 1) {
    const kind = SINGLE[work.kinds[0]];
    const key = `signout.q.${kind}.${work.total === 1 ? 'one' : 'many'}`;
    return format(t(key as MessageKey), { n });
  }
  const windowed = work.kinds.some((kind) => WINDOWED.includes(kind));
  return format(t(windowed ? 'signout.q.mixed-window' : 'signout.q.mixed'), {
    n,
  });
}
