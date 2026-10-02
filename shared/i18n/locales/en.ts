/** The source-of-truth catalogue. */
export const en = {
  'login.username': 'Username',
  'login.password': 'Password',
  'login.show-password': 'Show password',
  'login.hide-password': 'Hide password',
  'login.sign-in': 'Sign in',
  'login.signing-in': 'Signing in…',
  'login.forgot-password': 'Forgot your password? Ask your manager.',

  'login.err.title': 'Sign-in failed',
  'login.err.invalid': 'Username or password is wrong.',
  'login.err.rate-limited': 'Too many tries. Wait a minute.',
  'login.err.unreachable': "Can't reach mise. Try again.",

  'login.picker.title': 'Which business?',
  'login.picker.cancel': 'Cancel',

  'common.ok': 'OK',
  'common.retry': 'Retry',
  'common.offline': "Can't reach mise.",
  'common.loading': 'Loading…',

  'tab.home': 'Home',
  'tab.checklists': 'Checklists',
  'tab.issues': 'Issues',
  'tab.modules': 'Modules',
  'tab.more': 'More',
  'nav.tabs': 'Tabs',

  'home.empty.title': 'Nothing assigned to you yet',
  'home.empty.action': 'Go to Checklists',

  'more.settings': 'Settings',
  'more.administration': 'Administration',
  'more.outlets': 'Outlets',
  'more.users': 'Users',
  'common.back': 'Back',

  'admin.new': 'New',
  'admin.save': 'Save',
  'admin.cancel': 'Cancel',
  'admin.save-failed': "Couldn't save.",
  'admin.no-access': "You don't have access to this.",
  'outlets.new': 'New outlet',
  'outlets.name': 'Name',
  'outlets.name-taken': 'An outlet with this name already exists.',
  'outlets.show-archived': 'Show archived',
  'outlets.archived': 'Archived',
  'outlets.added':
    '{name} added. No checklists run here yet. Assign them from a checklist.',
  'outlets.renamed': 'Saved. Past records now show “{name}”.',
  'outlets.empty': 'No outlets yet',
  'outlets.add': 'Add outlet',
  'outlets.attendance': 'Record attendance at this outlet',
  'outlets.attendance-hint':
    'Attendance managers can mark who is present here.',
  'outlets.attendance-still-on': 'Attendance is still on.',
  'outlets.attendance-still-off': 'Attendance is still off.',
  'outlets.archive': 'Archive outlet',
  'outlets.archive-title': 'Archive {name}?',
  'outlets.archive-body': 'It will be hidden from lists. Its history stays.',
  'outlets.archive-confirm': 'Archive',
  'outlets.archive-failed': "Couldn't archive. It is still active.",
  'outlets.archived-note': "Archived. Its history stays; it can't be edited.",
  'outlets.archived-done': '{name} archived. Its history stays.',

  'placeholder.label': 'Placeholder',
  'placeholder.week': 'Specced and built in week {n}',

  'language.title': 'Language',
  'language.waiting': 'Waiting to save to your account',
  'settings.profile': 'Profile',
  'profile.full-name': 'Full name',
  'profile.username': 'Username',
  'profile.role': 'Role',
  'profile.business': 'Business',
  'profile.hint': 'To change your name or password, ask your manager.',
  'profile.hint-admin': 'To change your name or password, go to More → Users.',
  'role.OWNER': 'Owner',
  'role.ADMIN': 'Administrator',
  'role.MEMBER': 'Member',
  'signout.title': 'Sign out?',
  'signout.stay': 'Stay signed in',
  'signout.anyway': 'Sign out anyway',
  'signout.cancel': 'Cancel',
  'signout.confirm': 'Sign out',

  'theme.title': 'Theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',

  'signout.queued.language':
    "Your language choice hasn't been saved to your account yet. If you sign out now, it is lost.",

  'settings.sign-out': 'Sign out',

  'theme.switch-to-light': 'Switch to light theme',
  'theme.switch-to-dark': 'Switch to dark theme',
} as const;

export type Catalogue = Record<keyof typeof en, string>;
