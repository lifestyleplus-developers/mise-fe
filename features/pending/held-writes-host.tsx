import * as React from 'react';

import { useHomeNotice } from '@/features/home/home-notice';
import { useT } from '@/shared/i18n';
import { useHeldWrites } from '@/shared/stores/held-writes-store';
import { useSessionOwner } from '@/shared/stores/session-owner-store';

import { heldNotice, sendHeldWrites } from './held-writes';

type Props = { userId: number; name: string; businessId: number };

/**
 * Who is signed in, remembered so an ended session can be told apart from someone
 * else's; the work this person left when their last session ended, sent now; and,
 * for someone else's, a line on Home that it is kept for them. Mounted in the
 * signed-in shell, so a person is always signed in.
 */
export function HeldWritesHost({ userId, name, businessId }: Props) {
  const t = useT();
  const hydrated = useHeldWrites((state) => state.hasHydrated);
  const ownerHydrated = useSessionOwner((state) => state.hasHydrated);
  const setOwner = useSessionOwner((state) => state.setOwner);
  const setNotice = useHomeNotice((state) => state.setNotice);

  React.useEffect(() => {
    if (!hydrated || !ownerHydrated) return;
    setOwner({ userId, name, businessId });
    sendHeldWrites(userId);
    const notice = heldNotice(businessId, userId, t);
    if (notice) setNotice(notice);
    // Once per sign-in, not on every language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, ownerHydrated, userId, name, businessId]);

  return null;
}
