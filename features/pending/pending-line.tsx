import { PendingPill } from '@/shared/components/pending-pill';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { View } from 'react-native';

import {
  usePendingWrites,
  WRITE_KIND,
  type WriteKind,
} from './use-pending-writes';

/** Which wording names a single kind. Issue resolves read as "changes". */
const NAME: Record<WriteKind, string> = {
  [WRITE_KIND.ANSWER]: 'answers',
  [WRITE_KIND.PHOTO]: 'photos',
  [WRITE_KIND.MARK]: 'marks',
  [WRITE_KIND.STOCK]: 'stock',
  [WRITE_KIND.RESOLVE]: 'changes',
};

/**
 * The one line that says something is waiting to send (FE Spec §6), on every
 * tab. It names the kind when there is only one ("2 answers waiting to send") and
 * gives a total when there are several. Nothing is drawn when nothing waits, so
 * it is not a permanent "offline" badge that people learn to ignore.
 */
export function PendingLine() {
  const t = useT();
  const { total, kinds } = usePendingWrites();
  if (total === 0) return null;

  const label =
    kinds.length === 1
      ? t(
          `queue.line.${NAME[kinds[0]]}.${total === 1 ? 'one' : 'many'}` as MessageKey,
        )
      : t('queue.line.mixed');

  return (
    <View className="mx-4 mb-3">
      <PendingPill label={format(label, { n: String(total) })} />
    </View>
  );
}
