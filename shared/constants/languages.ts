/** `user.interface_language` — the schema's enum EN · HI · ML · KN (Model §15). */
export const INTERFACE_LANGUAGE = {
  EN: 'EN',
  HI: 'HI',
  ML: 'ML',
  KN: 'KN',
} as const;

export type InterfaceLanguage =
  (typeof INTERFACE_LANGUAGE)[keyof typeof INTERFACE_LANGUAGE];

/** Each language's name in its own script, so anyone can find theirs. */
export const INTERFACE_LANGUAGES: readonly {
  code: InterfaceLanguage;
  label: string;
}[] = [
  { code: 'EN', label: 'English' },
  { code: 'HI', label: 'हिन्दी' },
  { code: 'ML', label: 'മലയാളം' },
  { code: 'KN', label: 'ಕನ್ನಡ' },
];
