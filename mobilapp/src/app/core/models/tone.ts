/**
 * Semantic color tone, which UI components translate into design tokens.
 *
 * `selected` is the design's blue "selected" color (the carb bar), and `secondary` is
 * slate-400 (the fat bar) – they sit between `neutral` (slate-300) and `muted` (slate-500).
 */
export type Tone =
  | 'accent'
  | 'positive'
  | 'negative'
  | 'info'
  | 'selected'
  | 'neutral'
  | 'secondary'
  | 'muted'
  | 'warning';
