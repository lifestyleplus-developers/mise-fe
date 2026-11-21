import { Redirect } from 'expo-router';
import * as React from 'react';

import { dropSessionCache } from '@/shared/api/query-client';
import { runSignOutHandlers } from '@/shared/lib/on-sign-out';

/**
 * Where a screen sends the person when the platform has ended their session.
 * It does what sign-out does besides calling the server (the tokens are already
 * cleared): the cache, the queued writes and each feature's own data go, so the
 * next person to sign in on this phone cannot send them as themselves.
 */
export function ExpiredSessionRedirect() {
  React.useEffect(() => {
    dropSessionCache();
    // Who the session belonged to is no longer known: `me` never loaded.
    runSignOutHandlers(undefined);
  }, []);

  return <Redirect href="/" />;
}
