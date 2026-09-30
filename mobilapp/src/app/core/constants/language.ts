import { Language } from '../models/language';

export const DEFAULT_LANGUAGE: Language = 'da';

/** Each language named in itself, so it can be found whatever language the app is in. */
export const LANGUAGE_OPTIONS = [
  { value: 'da', label: 'Dansk' },
  { value: 'en', label: 'English' },
] as const satisfies readonly { readonly value: Language; readonly label: string }[];

/** The `Intl` locale numbers are formatted with in each language. */
export const INTL_LOCALE: Readonly<Record<Language, string>> = { da: 'da-DK', en: 'en-GB' };
