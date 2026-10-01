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

/**
 * The English catalogue is the single source of truth: its keys and value
 * types define what every other locale must (eventually) provide. MessageKey
 * is a union of the literal keys, so `t('login.usernme')` is a compile
 * error, and a key present in a partial but missing from `en` never
 * typechecks.
 */
export type MessageKey = keyof typeof en;

type Catalogue = Record<MessageKey, string>;

/**
 * Partial by design: Language Assist §5 — Lifestyle supplies or approves the
 * Hindi, Malayalam and Kannada wording, and §5 also sets the rule that a
 * missing string falls back to its English equivalent. These catalogues fill
 * in as translations land; the mechanism works with none of them.
 */
const PARTIAL_LOCALES: Record<
  Exclude<InterfaceLanguage, 'EN'>,
  Partial<Catalogue>
> = { HI: hi, ML: ml, KN: kn };

/**
 * Plain lookup, usable outside React (notification wording will need it).
 * `language` is explicit; the React binding is `useT`.
 */
export function t(language: InterfaceLanguage, key: MessageKey): string {
  if (language === INTERFACE_LANGUAGE.EN) return en[key];
  return PARTIAL_LOCALES[language][key] ?? en[key];
}

/**
 * React binding. Subscribes to the language store, so a Settings change
 * re-renders every mounted screen's strings without any per-screen work.
 */
export function useT() {
  const language = useLanguageStore((state) => state.language);
  return useCallback((key: MessageKey) => t(language, key), [language]);
}

/**
 * Fills `{name}`-style placeholders in a catalogue string. Values are plain
 * strings because catalogues are plain strings — the few strings that take
 * a value declare their placeholder inline ('Signed in as {name}.') so the
 * translation can move it, which word order sometimes requires.
 */
export function format(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    values[key] !== undefined ? values[key] : match,
  );
}
