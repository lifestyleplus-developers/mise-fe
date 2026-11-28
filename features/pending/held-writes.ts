import { format, type MessageKey } from '@/shared/i18n';
import { queryClient } from '@/shared/api/query-client';
import { useHeldWrites } from '@/shared/stores/held-writes-store';

// Their defaults (what sends them) are registered where each is defined; a held
// resolve is the one kind no other import here brings in.
import '@/features/issues/use-incident';
import '@/features/pending/late-writes';

/**
 * This person is signed in again: send what they were holding. Each is taken out
 * of the store before it is sent, so it can be lost if the app dies mid-send but
 * never sent twice (a stock entry must not be recorded twice). A write the window
 * has since closed on is refused as any late write is, and the person is told.
 */
export function sendHeldWrites(userId: number): void {
  for (const item of useHeldWrites.getState().takeFor(userId)) {
    const mutation = queryClient.getMutationCache().build(queryClient, {
      ...queryClient.defaultMutationOptions({
        mutationKey: [...item.mutationKey],
      }),
      networkMode: 'online',
      meta: { detail: item.detail },
    });
    void mutation.execute(item.variables).catch(() => undefined);
  }
}

/**
 * The message for Home when someone else signs in on a phone that holds this
 * person's answers (`otherUserSignedIn`): only for the same business, and only
 * when the held work is all answers, the one kind the design words.
 */
export function heldNotice(
  businessId: number,
  userId: number,
  t: (key: MessageKey) => string,
): string | null {
  const others = useHeldWrites
    .getState()
    .items.filter(
      (item) => item.businessId === businessId && item.ownerId !== userId,
    );
  if (others.length === 0) return null;
  const ownerId = others[0].ownerId;
  const theirs = others.filter((item) => item.ownerId === ownerId);
  const answers = theirs.filter(
    (item) => item.mutationKey.join('/') === 'run-tasks/answer',
  );
  if (answers.length !== theirs.length) return null;
  return format(
    t(answers.length === 1 ? 'queue.kept.one' : 'queue.kept.many'),
    { name: theirs[0].ownerName, n: String(answers.length) },
  );
}

const KIND_OF_KEY: Record<
  string,
  'answers' | 'marks' | 'stock' | 'photos' | 'changes'
> = {
  'run-tasks/answer': 'answers',
  'attendance/mark': 'marks',
  'inventory/record': 'stock',
  'spot-checks/photo': 'photos',
  'incidents/resolve': 'changes',
};

/**
 * What Login says it is holding for someone who comes back after their session
 * ended ("3 answers on this phone are waiting to be sent"). Null when nothing is
 * held. Answers have their own wording; every other kind uses the pending line's.
 */
export function heldLine(
  items: readonly { mutationKey: readonly unknown[] }[],
  t: (key: MessageKey) => string,
): string | null {
  if (items.length === 0) return null;
  const kinds = new Set(
    items.map((item) => KIND_OF_KEY[item.mutationKey.join('/')]),
  );
  const n = String(items.length);
  const many = items.length === 1 ? 'one' : 'many';
  if (kinds.size > 1) return format(t('queue.line.mixed'), { n });
  const [kind] = [...kinds];
  const key =
    kind === 'answers' ? `login.waiting.${many}` : `queue.line.${kind}.${many}`;
  return format(t(key as MessageKey), { n });
}
