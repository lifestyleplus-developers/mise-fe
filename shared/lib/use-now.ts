import * as React from 'react';

import { serverNow } from '@/shared/api/server-clock';

/**
 * The current time as the platform sees it, re-read on an interval so "open" and
 * "closed" stay true without a refetch. It follows the platform's clock, not the
 * phone's, which may be minutes out.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = React.useState(() => serverNow());
  React.useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
