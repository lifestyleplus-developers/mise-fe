import * as React from 'react';

/**
 * Drives a list's pull-to-refresh spinner. It shows only while a refresh the person
 * asked for is running. It is deliberately not tied to "is this query refetching?":
 * a refetch also happens in the background (switching tabs, coming back to the app),
 * and the phone's own spinner would then drop over the screen with nobody pulling.
 */
export function usePullToRefresh(refetch: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    Promise.resolve(refetch())
      .catch(() => undefined) // a failed refresh shows its own banner
      .finally(() => setRefreshing(false));
  }, [refetch]);
  return { refreshing, onRefresh };
}
