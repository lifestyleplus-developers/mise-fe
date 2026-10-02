import { SignOutButton } from '@/features/auth/sign-out-button';
import { createPlaceholder } from '@/features/shell/placeholder';

export default createPlaceholder({
  title: 'more.settings',
  frame: 'pushed',
  id: 'FND-03',
  name: 'Settings: language, profile, sign out',
  week: 2,
  children: <SignOutButton />,
});
