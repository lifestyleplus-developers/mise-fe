import type { Catalogue } from './en';

// Draft wording, pending Lifestyle's review (Language Assist §5).
export const kn = {
  'login.username': 'ಬಳಕೆದಾರ ಹೆಸರು',
  'login.password': 'ಪಾಸ್‌ವರ್ಡ್',
  'login.show-password': 'ಪಾಸ್‌ವರ್ಡ್ ತೋರಿಸಿ',
  'login.hide-password': 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆಮಾಡಿ',
  'login.sign-in': 'ಸೈನ್ ಇನ್ ಮಾಡಿ',
  'login.signing-in': 'ಸೈನ್ ಇನ್ ಆಗುತ್ತಿದೆ…',
  'login.forgot-password': 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ? ನಿಮ್ಮ ಮ್ಯಾನೇಜರ್ ಅವರನ್ನು ಕೇಳಿ.',

  'login.err.title': 'ಸೈನ್ ಇನ್ ವಿಫಲವಾಗಿದೆ',
  'login.err.invalid': 'ಬಳಕೆದಾರ ಹೆಸರು ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ತಪ್ಪಾಗಿದೆ.',
  'login.err.rate-limited': 'ಹಲವು ಪ್ರಯತ್ನಗಳು. ಒಂದು ನಿಮಿಷ ಕಾಯಿರಿ.',
  'login.err.unreachable': 'mise ಅನ್ನು ತಲುಪಲು ಆಗುತ್ತಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',

  // Shell and Home — stand-in wording from the week-1 mockup, unreviewed.
  'tab.home': 'ಮುಖಪುಟ',
  'tab.checklists': 'ಚೆಕ್‌ಲಿಸ್ಟ್‌ಗಳು',
  'tab.issues': 'ಸಮಸ್ಯೆಗಳು',
  'tab.modules': 'ಮಾಡ್ಯೂಲ್‌ಗಳು',
  'tab.more': 'ಇನ್ನಷ್ಟು',
  'nav.tabs': 'ಟ್ಯಾಬ್‌ಗಳು',
  'home.empty.title': 'ನಿಮಗೆ ಇನ್ನೂ ಏನನ್ನೂ ನಿಯೋಜಿಸಲಾಗಿಲ್ಲ',
  'home.empty.action': 'ಚೆಕ್‌ಲಿಸ್ಟ್‌ಗಳಿಗೆ ಹೋಗಿ',
  'common.offline': 'mise ಗೆ ಸಂಪರ್ಕಿಸಲು ಆಗುತ್ತಿಲ್ಲ.',
  'common.retry': 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
  'common.loading': 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
  'settings.sign-out': 'ಸೈನ್ ಔಟ್',

  'login.picker.title': 'ಯಾವ ವ್ಯವಹಾರ?',
  'login.picker.cancel': 'ರದ್ದುಮಾಡಿ',

  'common.ok': 'ಸರಿ',

  'theme.switch-to-light': 'ಲೈಟ್ ಥೀಮ್‌ಗೆ ಬದಲಿಸಿ',
  'theme.switch-to-dark': 'ಡಾರ್ಕ್ ಥೀಮ್‌ಗೆ ಬದಲಿಸಿ',

  // More tab — stand-in wording from the week-2 mockup, unreviewed.
  'more.settings': 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
  'more.administration': 'ಆಡಳಿತ',
  'more.outlets': 'ಔಟ್‌ಲೆಟ್‌ಗಳು',
  'more.users': 'ಬಳಕೆದಾರರು',
  'common.back': 'ಹಿಂದೆ',
} satisfies Partial<Catalogue>;
