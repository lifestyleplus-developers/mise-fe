import type { Catalogue } from './en';

// Draft wording, pending Lifestyle's review (Language Assist §5).
export const hi = {
  'login.username': 'उपयोगकर्ता नाम',
  'login.password': 'पासवर्ड',
  'login.show-password': 'पासवर्ड दिखाएँ',
  'login.hide-password': 'पासवर्ड छिपाएँ',
  'login.sign-in': 'साइन इन करें',
  'login.signing-in': 'साइन इन हो रहा है…',
  'login.forgot-password': 'पासवर्ड भूल गए? अपने मैनेजर से पूछें।',
  'login.signed-in-as': '{name} के रूप में साइन इन किया है।',
  'login.sign-out': 'साइन आउट करें',

  'login.err.title': 'साइन इन नहीं हो सका',
  'login.err.invalid': 'उपयोगकर्ता नाम या पासवर्ड गलत है।',
  'login.err.rate-limited': 'बहुत ज़्यादा कोशिशें। एक मिनट रुकें।',
  'login.err.unreachable': 'mise तक नहीं पहुँच पा रहे। फिर से कोशिश करें।',
  'login.err.ambiguous': 'यह उपयोगकर्ता नाम एक से अधिक व्यवसायों में मौजूद है।',

  'common.ok': 'ठीक है',

  'theme.switch-to-light': 'लाइट थीम पर जाएँ',
  'theme.switch-to-dark': 'डार्क थीम पर जाएँ',
} satisfies Partial<Catalogue>;
