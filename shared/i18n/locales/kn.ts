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
  'login.signed-in-as': '{name} ಆಗಿ ಸೈನ್ ಇನ್ ಆಗಿದ್ದೀರಿ.',
  'login.sign-out': 'ಸೈನ್ ಔಟ್ ಮಾಡಿ',

  'login.err.title': 'ಸೈನ್ ಇನ್ ವಿಫಲವಾಗಿದೆ',
  'login.err.invalid': 'ಬಳಕೆದಾರ ಹೆಸರು ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ತಪ್ಪಾಗಿದೆ.',
  'login.err.rate-limited': 'ಹಲವು ಪ್ರಯತ್ನಗಳು. ಒಂದು ನಿಮಿಷ ಕಾಯಿರಿ.',
  'login.err.unreachable': 'mise ಅನ್ನು ತಲುಪಲು ಆಗುತ್ತಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  'login.err.ambiguous':
    'ಈ ಬಳಕೆದಾರ ಹೆಸರು ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ವ್ಯವಹಾರಗಳಲ್ಲಿ ಇದೆ.',

  'common.ok': 'ಸರಿ',

  'theme.switch-to-light': 'ಲೈಟ್ ಥೀಮ್‌ಗೆ ಬದಲಿಸಿ',
  'theme.switch-to-dark': 'ಡಾರ್ಕ್ ಥೀಮ್‌ಗೆ ಬದಲಿಸಿ',
} satisfies Partial<Catalogue>;
