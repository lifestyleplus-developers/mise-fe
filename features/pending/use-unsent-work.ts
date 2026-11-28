import { useUnsentPhotoCount } from '@/features/spot-checks/use-unsent-photos';

import {
  usePendingWrites,
  WRITE_KIND,
  type PendingWrites,
} from './use-pending-writes';

/**
 * What signing out would lose: every queued write, plus spot-check photographs
 * that are still only on this phone. It is `usePendingWrites` with the photograph
 * count widened, because a photograph is lost before it is even queued.
 */
export function useUnsentWork(): PendingWrites {
  const writes = usePendingWrites();
  const photos = useUnsentPhotoCount();
  const byKind = { ...writes.byKind, [WRITE_KIND.PHOTO]: photos };
  const kinds = (Object.keys(byKind) as (keyof typeof byKind)[]).filter(
    (kind) => byKind[kind] > 0,
  );
  return {
    byKind,
    total: kinds.reduce((sum, kind) => sum + byKind[kind], 0),
    kinds,
  };
}
