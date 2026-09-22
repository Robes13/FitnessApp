import { Theme } from '../models/theme';

/** Designet er mørkt som udgangspunkt; lys tilstand vælges manuelt i Profil. */
export const DEFAULT_THEME: Theme = 'dark';

/** Attribut på `<html>`, som `_tokens.scss` skifter tema på. */
export const THEME_ATTRIBUTE = 'data-theme';
