import { Theme } from '../models/theme';

/** The design is dark by default; light mode is enabled manually in Profile. */
export const DEFAULT_THEME: Theme = 'dark';

/** Attribute on `<html>` that `_tokens.scss` switches the theme on. */
export const THEME_ATTRIBUTE = 'data-theme';
