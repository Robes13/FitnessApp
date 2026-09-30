import { LANGUAGE_OPTIONS } from '../constants/language';
import { Language } from '../models/language';

export function isLanguage(value: unknown): value is Language {
  return LANGUAGE_OPTIONS.some((option) => option.value === value);
}
