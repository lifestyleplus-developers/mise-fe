import { useNavigation } from 'expo-router';
import * as React from 'react';

type UnsavedChangesOptions<T> = {
  /** The form as it was loaded or last saved. */
  initial: T;
  /** The form as it stands now. */
  current: T;
  /** A save is in flight. */
  saving?: boolean;
};

/**
 * What an editor needs to know about its own state, in one place: whether it
 * has changed, whether it can be saved, and the "discard changes?" question
 * when someone tries to leave with unsaved work.
 *
 * Leaving by any route is caught — the Back button, the Android back key and
 * the swipe — because it listens to the navigation itself. A screen that has
 * just saved leaves with `leave`, which does not ask.
 *
 * `initial` and `current` are compared as JSON, so build them the same way
 * (same keys, same order, arrays sorted) or two equal forms will read as
 * changed.
 */
export function useUnsavedChanges<T>({
  initial,
  current,
  saving = false,
}: UnsavedChangesOptions<T>) {
  const navigation = useNavigation();
  const changed = JSON.stringify(initial) !== JSON.stringify(current);
  // A save in flight is not interrupted by asking: it finishes on its own.
  const guarding = changed && !saving;

  const [discardOpen, setDiscardOpen] = React.useState(false);
  const pending = React.useRef<
    Parameters<typeof navigation.dispatch>[0] | null
  >(null);
  const bypass = React.useRef(false);

  React.useEffect(() => {
    if (!guarding) return;
    return navigation.addListener('beforeRemove', (event) => {
      if (bypass.current) return;
      event.preventDefault();
      pending.current = event.data.action;
      setDiscardOpen(true);
    });
  }, [navigation, guarding]);

  /** Runs a navigation without the question; for after a successful save. */
  function leave(navigate: () => void) {
    bypass.current = true;
    try {
      navigate();
    } finally {
      bypass.current = false;
    }
  }

  function keepEditing() {
    pending.current = null;
    setDiscardOpen(false);
  }

  function discard() {
    const action = pending.current;
    pending.current = null;
    setDiscardOpen(false);
    if (action) leave(() => navigation.dispatch(action));
  }

  return {
    changed,
    saving,
    /** Save is worth offering: something changed and nothing is in flight. */
    canSave: changed && !saving,
    discardOpen,
    keepEditing,
    discard,
    leave,
  };
}
