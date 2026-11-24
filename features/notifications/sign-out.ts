import { onSignOut } from '@/shared/lib/on-sign-out';

import { dropTap } from './pending-tap';

// Imported once by the root layout, so it is registered however the app starts.
onSignOut(() => {
  dropTap();
});
