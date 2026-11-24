import { onSignOut } from '@/shared/lib/on-sign-out';

import { usePhotoOutbox } from './photo-outbox';

// Imported once by the root layout, so it is registered however the app starts.
onSignOut((userId) => {
  // This person's photographs not yet in storage do not outlive the session;
  // another person's on the same phone are left alone.
  if (userId !== undefined) usePhotoOutbox.getState().clearFor(userId);
});
