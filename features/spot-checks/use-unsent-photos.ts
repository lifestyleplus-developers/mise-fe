import { useMe } from '@/features/auth/use-me';

import { usePhotoOutbox } from './photo-outbox';
import { useSpotPhotoQueue } from './use-spot-photo-queue';

/**
 * Photographs that exist only on this phone: ones not yet in storage, and ones in
 * storage whose send is still waiting. Signing out loses them, so it says so first.
 */
export function useUnsentPhotoCount(): number {
  const { data: me } = useMe();
  const userId = me?.user.id;
  // A number, not a filtered list: the store compares what a selector returns.
  const drafts = usePhotoOutbox(
    (state) => state.drafts.filter((draft) => draft.userId === userId).length,
  );
  const waiting = useSpotPhotoQueue(undefined).filter(
    (write) => write.kind === 'waiting',
  ).length;
  return userId === undefined ? 0 : drafts + waiting;
}
