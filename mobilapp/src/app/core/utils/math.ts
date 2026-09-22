/**
 * Runder til `decimals` decimaler. `+ 0` normaliserer `-0` (fx `-28 * 0`) til `0`, så
 * afrundede værdier kan sammenlignes strengt.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor + 0;
}

/** Begrænser `value` til intervallet `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
