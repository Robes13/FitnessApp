/**
 * Rounds to `decimals` decimal places. `+ 0` normalizes `-0` (e.g. `-28 * 0`) to `0`, so
 * rounded values can be compared strictly.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor + 0;
}

/** Clamps `value` to the range `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
