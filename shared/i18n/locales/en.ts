/**
 * The source-of-truth catalogue. Values here define the types every other
 * locale must satisfy; new interface strings land here first.
 *
 * Keyed `screen.name` like the mockup addressed them (login.username,
 * login.err.invalid) — dot namespaces keep catalogues greppable against
 * screens.
 */
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

  // §2's 409 — the same username in more than one business.
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

  // Home (FE Spec §3.2). An OWNER or ADMIN with no assignments is not looking
  // at an error — the pointer goes to where checklists are made.
  'home.empty.title': 'Nothing assigned to you yet',
  'home.empty.action': 'Go to Checklists',

  // More tab (FE Spec §2) and the screens it opens.
  'more.settings': 'Settings',
  'more.administration': 'Administration',
  'more.outlets': 'Outlets',
  'more.users': 'Users',
  'common.back': 'Back',

  // Developer-facing: marks a tab whose screen is specced for a later week.
  'placeholder.label': 'Placeholder',
  'placeholder.week': 'Specced and built in week {n}',

  'settings.sign-out': 'Sign out',

  'theme.switch-to-light': 'Switch to light theme',
  'theme.switch-to-dark': 'Switch to dark theme',
} as const;

export type Catalogue = Record<keyof typeof en, string>;
