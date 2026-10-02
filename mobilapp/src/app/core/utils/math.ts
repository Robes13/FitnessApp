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

/**
 * A typed number with a decimal comma or point (`'45,5'` and `'45.5'` → 45.5), for number
 * fields that are `type="text"`: Android's WebView drops the comma in a `type="number"` field
 * (`'45,5'` → `455`). `null` when the text is empty or not a number, like a native number field.
 */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  const value = Number(trimmed.replace(',', '.'));
  return trimmed === '' || !Number.isFinite(value) ? null : value;
}
