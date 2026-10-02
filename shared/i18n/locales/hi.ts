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

  'login.err.title': 'साइन इन नहीं हो सका',
  'login.err.invalid': 'उपयोगकर्ता नाम या पासवर्ड गलत है।',
  'login.err.rate-limited': 'बहुत ज़्यादा कोशिशें। एक मिनट रुकें।',
  'login.err.unreachable': 'mise तक नहीं पहुँच पा रहे। फिर से कोशिश करें।',

  // Shell and Home — stand-in wording from the week-1 mockup, unreviewed.
  'tab.home': 'होम',
  'tab.checklists': 'चेकलिस्ट',
  'tab.issues': 'समस्याएँ',
  'tab.modules': 'मॉड्यूल',
  'tab.more': 'और',
  'nav.tabs': 'टैब',
  'home.empty.title': 'आपको अभी कुछ नहीं सौंपा गया है',
  'home.empty.action': 'चेकलिस्ट पर जाएँ',
  'common.offline': 'mise से कनेक्ट नहीं हो पा रहा।',
  'common.retry': 'फिर कोशिश करें',
  'common.loading': 'लोड हो रहा है…',
  'settings.sign-out': 'साइन आउट',

  'login.picker.title': 'कौन-सा बिज़नेस?',
  'login.picker.cancel': 'रद्द करें',

  'common.ok': 'ठीक है',

  'theme.switch-to-light': 'लाइट थीम पर जाएँ',
  'theme.switch-to-dark': 'डार्क थीम पर जाएँ',

  // More tab — stand-in wording from the week-2 mockup, unreviewed.
  'more.settings': 'सेटिंग्स',
  'more.administration': 'प्रशासन',
  'more.outlets': 'आउटलेट',
  'more.users': 'उपयोगकर्ता',
  'common.back': 'वापस',

  // Settings — stand-in wording from the week-2 mockup, unreviewed.
  'language.title': 'भाषा',
  'language.waiting': 'आपके खाते में सेव होने का इंतज़ार',
  'settings.profile': 'प्रोफ़ाइल',
  'profile.full-name': 'पूरा नाम',
  'profile.username': 'यूज़रनेम',
  'profile.role': 'भूमिका',
  'profile.business': 'बिज़नेस',
  'profile.hint': 'नाम या पासवर्ड बदलने के लिए अपने मैनेजर से पूछें।',
  'role.OWNER': 'मालिक',
  'role.ADMIN': 'प्रशासक',
  'role.MEMBER': 'सदस्य',
  'signout.title': 'साइन आउट करें?',
  'signout.stay': 'साइन इन रहें',
  'signout.anyway': 'फिर भी साइन आउट करें',
  'signout.cancel': 'रद्द करें',
  'signout.confirm': 'साइन आउट',
} satisfies Partial<Catalogue>;
