/**
 * `user.interface_language` — the schema's enum EN · HI · ML · KN (Model §15).
 * The language is a property of the user, not the device or the request, so
 * the same person sees the same interface on any phone. Lives here rather
 * than in the API types so stores and catalogues can use it without
 * importing contract shapes.
 */
export const INTERFACE_LANGUAGE = {
  EN: 'EN',
  HI: 'HI',
  ML: 'ML',
  KN: 'KN',
} as const;

export type InterfaceLanguage =
  (typeof INTERFACE_LANGUAGE)[keyof typeof INTERFACE_LANGUAGE];
