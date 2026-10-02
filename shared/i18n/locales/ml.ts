import type { Catalogue } from './en';

// Draft wording, pending Lifestyle's review (Language Assist §5).
export const ml = {
  'login.username': 'ഉപയോക്തൃനാമം',
  'login.password': 'പാസ്‌വേഡ്',
  'login.show-password': 'പാസ്‌വേഡ് കാണിക്കുക',
  'login.hide-password': 'പാസ്‌വേഡ് മറയ്ക്കുക',
  'login.sign-in': 'സൈൻ ഇൻ ചെയ്യുക',
  'login.signing-in': 'സൈൻ ഇൻ ചെയ്യുന്നു…',
  'login.forgot-password': 'പാസ്‌വേഡ് മറന്നോ? നിങ്ങളുടെ മാനേജരോട് ചോദിക്കുക.',

  'login.err.title': 'സൈൻ ഇൻ പരാജയപ്പെട്ടു',
  'login.err.invalid': 'ഉപയോക്തൃനാമമോ പാസ്‌വേഡോ തെറ്റാണ്.',
  'login.err.rate-limited': 'വളരെയധികം ശ്രമങ്ങൾ. ഒരു മിനിറ്റ് കാത്തിരിക്കുക.',
  'login.err.unreachable':
    'mise-ലേക്ക് എത്താൻ കഴിയുന്നില്ല. വീണ്ടും ശ്രമിക്കുക.',

  // Shell and Home — stand-in wording from the week-1 mockup, unreviewed.
  'tab.home': 'ഹോം',
  'tab.checklists': 'ചെക്ക്‌ലിസ്റ്റുകൾ',
  'tab.issues': 'പ്രശ്നങ്ങൾ',
  'tab.modules': 'മൊഡ്യൂളുകൾ',
  'tab.more': 'കൂടുതൽ',
  'nav.tabs': 'ടാബുകൾ',
  'home.empty.title': 'നിങ്ങൾക്ക് ഇതുവരെ ഒന്നും നൽകിയിട്ടില്ല',
  'home.empty.action': 'ചെക്ക്‌ലിസ്റ്റുകളിലേക്ക് പോകുക',
  'common.offline': 'mise-ഉമായി ബന്ധിപ്പിക്കാനാകുന്നില്ല.',
  'common.retry': 'വീണ്ടും ശ്രമിക്കുക',
  'common.loading': 'ലോഡ് ചെയ്യുന്നു…',
  'settings.sign-out': 'സൈൻ ഔട്ട്',

  'login.picker.title': 'ഏത് ബിസിനസ്?',
  'login.picker.cancel': 'റദ്ദാക്കുക',

  'common.ok': 'ശരി',

  'theme.switch-to-light': 'ലൈറ്റ് തീമിലേക്ക് മാറുക',
  'theme.switch-to-dark': 'ഡാർക്ക് തീമിലേക്ക് മാറുക',

  // More tab — stand-in wording from the week-2 mockup, unreviewed.
  'more.settings': 'ക്രമീകരണങ്ങൾ',
  'more.administration': 'ഭരണം',
  'more.outlets': 'ഔട്ട്‌ലെറ്റുകൾ',
  'more.users': 'ഉപയോക്താക്കൾ',
  'common.back': 'തിരികെ',
} satisfies Partial<Catalogue>;
