/**
 * Semantisk farvetone, som UI-komponenter oversætter til design tokens.
 *
 * `selected` er designets blå "valgt"-farve (kulhydrat-bjælken), og `secondary` er
 * slate-400 (fedt-bjælken) – de ligger mellem `neutral` (slate-300) og `muted` (slate-500).
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
