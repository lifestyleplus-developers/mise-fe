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
  'login.signed-in-as': 'Signed in as {name}.',
  'login.sign-out': 'Sign out',

  'login.err.title': 'Sign-in failed',
  'login.err.invalid': 'Username or password is wrong.',
  'login.err.rate-limited': 'Too many tries. Wait a minute.',
  'login.err.unreachable': "Can't reach mise. Try again.",
  // §2's 409 — the business picker is not built yet; the dialog says what is
  // true without pretending a credential failure.
  'login.err.ambiguous': 'This username exists in more than one business.',

  'common.ok': 'OK',

  'theme.switch-to-light': 'Switch to light theme',
  'theme.switch-to-dark': 'Switch to dark theme',
} as const;

export type Catalogue = Record<keyof typeof en, string>;
