/**
 * How the keyboard state reaches the styles: a CSS variable with the keyboard's height and a
 * `data-keyboard` attribute on `<html>`. Tokens in `styles/_tokens.scss` read both.
 */
export const KEYBOARD_CSS = {
  INSET_VARIABLE: '--keyboard-inset',
  STATE_ATTRIBUTE: 'data-keyboard',
  OPEN: 'open',
} as const;

/** Elements that take text input – a tap on one of them keeps the keyboard open. */
export const TEXT_ENTRY_SELECTOR = 'input, textarea, select, [contenteditable]';
