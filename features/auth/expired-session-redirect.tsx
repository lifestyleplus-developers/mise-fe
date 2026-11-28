import { Redirect } from 'expo-router';
import * as React from 'react';

import { endSession } from '@/shared/api/query-client';
import { runSignOutHandlers } from '@/shared/lib/on-sign-out';

/**
 * Where a screen sends the person when the platform has ended their session.
 * It does what sign-out does besides calling the server (the tokens are already
 * cleared): the cache and each feature's own data go, so the next person to sign in
 * on this phone cannot see them. Unsent work is not lost: it is held under the name
 * of the person who did it and sent when they sign in again (`endSession`).
 */
export function ExpiredSessionRedirect() {
  React.useEffect(() => {
    endSession();
    // Who the session belonged to is no longer known: `me` never loaded.
    runSignOutHandlers(undefined);
  }, []);

  return <Redirect href="/" />;
}
