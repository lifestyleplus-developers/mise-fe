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
  'login.signed-in-as': '{name} ആയി സൈൻ ഇൻ ചെയ്തിരിക്കുന്നു.',
  'login.sign-out': 'സൈൻ ഔട്ട് ചെയ്യുക',

  'login.err.title': 'സൈൻ ഇൻ പരാജയപ്പെട്ടു',
  'login.err.invalid': 'ഉപയോക്തൃനാമമോ പാസ്‌വേഡോ തെറ്റാണ്.',
  'login.err.rate-limited': 'വളരെയധികം ശ്രമങ്ങൾ. ഒരു മിനിറ്റ് കാത്തിരിക്കുക.',
  'login.err.unreachable':
    'mise-ലേക്ക് എത്താൻ കഴിയുന്നില്ല. വീണ്ടും ശ്രമിക്കുക.',
  'login.err.ambiguous': 'ഈ ഉപയോക്തൃനാമം ഒന്നിലധികം ബിസിനസുകളിൽ ഉണ്ട്.',

  'common.ok': 'ശരി',

  'theme.switch-to-light': 'ലൈറ്റ് തീമിലേക്ക് മാറുക',
  'theme.switch-to-dark': 'ഡാർക്ക് തീമിലേക്ക് മാറുക',
} satisfies Partial<Catalogue>;
