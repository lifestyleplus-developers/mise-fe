import { useCallback } from 'react';

import {
  INTERFACE_LANGUAGE,
  type InterfaceLanguage,
} from '@/shared/constants/languages';
import { useLanguageStore } from '@/shared/stores/language-store';

import { en } from './locales/en';
import { hi } from './locales/hi';
import { kn } from './locales/kn';
import { ml } from './locales/ml';

export { INTERFACE_LANGUAGE };
export type { InterfaceLanguage };

/** English is the source of truth for every locale's keys. */
export type MessageKey = keyof typeof en;

type Catalogue = Record<MessageKey, string>;

/** HI/ML/KN are partial; missing strings fall back to English (Language Assist §5). */
const PARTIAL_LOCALES: Record<
  Exclude<InterfaceLanguage, 'EN'>,
  Partial<Catalogue>
> = { HI: hi, ML: ml, KN: kn };

/** Plain lookup, usable outside React (notification wording will need it). */
export function t(language: InterfaceLanguage, key: MessageKey): string {
  if (language === INTERFACE_LANGUAGE.EN) return en[key];
  return PARTIAL_LOCALES[language][key] ?? en[key];
}

/** React binding. */
export function useT() {
  const language = useLanguageStore((state) => state.language);
  return useCallback((key: MessageKey) => t(language, key), [language]);
}

/** Fills `{name}`-style placeholders in a catalogue string. */
export function format(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    values[key] !== undefined ? values[key] : match,
  );
}
