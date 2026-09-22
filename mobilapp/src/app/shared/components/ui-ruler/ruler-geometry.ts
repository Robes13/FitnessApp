/**
 * Linealens geometri – en generisk port af designets `ruler(min, max, val, step, bleed)` og
 * `stepRuler(val, bleed)`. Én streg pr. `tickUnit` (1 kg, 1 cm, 100 skridt …), `pxPerTick`
 * pixel mellem stregerne; hver 5./10. streg er mellem/stor, og stregerne nær den aktuelle værdi
 * "gløder" orange med en styrke, der aftager over `reach` streger og skaleres med `bleed`.
 */
export type RulerTickKind = 'current' | 'major' | 'minor';

export interface RulerTick {
  /** Afstand fra linealens nulpunkt i px. */
  readonly x: number;
  /** Streghøjde i px (grundhøjde + glødtillæg). */
  readonly height: number;
  readonly kind: RulerTickKind;
  /** Glødens styrke i procent til `color-mix`, eller `null` når stregen har sin grundfarve. */
  readonly glowPercent: number | null;
}

export interface RulerLabel {
  readonly x: number;
  readonly text: string;
}

export interface RulerGeometry {
  readonly ticks: readonly RulerTick[];
  readonly labels: readonly RulerLabel[];
  /** Sporets vandrette forskydning i px, så den aktuelle værdi står under midterlinjen. */
  readonly offset: number;
}

export type RulerLabelFormatter = (tickValue: number) => string;

export interface RulerGeometryOptions {
  readonly min: number;
  readonly max: number;
  readonly value: number;
  /** Værdi pr. streg. */
  readonly tickUnit: number;
  /** Pixel pr. streg. */
  readonly pxPerTick: number;
  /** Hver n'te streg (i absolutte streg-numre) er stor. */
  readonly majorEvery: number;
  /** Hver n'te streg er mellemhøj. */
  readonly midEvery: number;
  /** Hver n'te streg får en etiket. */
  readonly labelEvery: number;
  /** Glødens maksimale styrke (0..1): 0,35 i hvile, 1 under træk. */
  readonly bleed: number;
  /** Hvor mange streger gløden rækker til hver side. */
  readonly reach: number;
  readonly labelFormatter: RulerLabelFormatter;
}

/** Glød i hvile (designets standard for `ruler()`). */
export const RULER_BLEED_IDLE = 0.35;
/** Glød i hvile på vægt-, højde- og skridt-linealerne (designets 0.4). */
export const RULER_BLEED_IDLE_STRONG = 0.4;
/** Glød mens brugeren trækker. */
export const RULER_BLEED_DRAGGING = 1;
/** Designets `reach` for kg/cm-linealer (skridt-linealen bruger 8). */
export const RULER_DEFAULT_GLOW_REACH = 6;

const TICK_HEIGHT = { current: 34, major: 28, mid: 18, minor: 10 } as const;
const GLOW_HEIGHT_BONUS = 9;
const GLOW_THRESHOLD = 0.06;
const GLOW_ALPHA_BASE = 0.3;
const GLOW_ALPHA_RANGE = 0.7;
const PERCENT = 100;
const PX_PRECISION = 100;
const EPSILON = 1e-9;

const EMPTY_GEOMETRY: RulerGeometry = { ticks: [], labels: [], offset: 0 };

/** Standardetiket: værdien som den er. */
export function formatRulerLabel(tickValue: number): string {
  return String(tickValue);
}

/** Runder px til to decimaler, så DOM'en ikke fyldes med flydende-tal-støj (5,6 × 58 …). */
function roundPx(value: number): number {
  return Math.round(value * PX_PRECISION) / PX_PRECISION;
}

export function computeRulerGeometry(options: RulerGeometryOptions): RulerGeometry {
  const { min, max, value, tickUnit, pxPerTick, majorEvery, midEvery, labelEvery, bleed, reach } =
    options;
  if (!(tickUnit > 0) || !(pxPerTick > 0) || !(reach > 0) || max < min) {
    return EMPTY_GEOMETRY;
  }

  const count = Math.floor((max - min) / tickUnit + EPSILON);
  const valueTicks = (value - min) / tickUnit;
  const currentIndex = Math.round(valueTicks);
  const ticks: RulerTick[] = [];
  const labels: RulerLabel[] = [];

  for (let index = 0; index <= count; index++) {
    const tickValue = min + index * tickUnit;
    const tickNumber = Math.round(tickValue / tickUnit);
    const isCurrent = index === currentIndex;
    const isMajor = tickNumber % majorEvery === 0;
    const isMid = tickNumber % midEvery === 0;
    const near = Math.max(0, 1 - Math.abs(index - valueTicks) / reach) * bleed;
    const baseHeight = isCurrent
      ? TICK_HEIGHT.current
      : isMajor
        ? TICK_HEIGHT.major
        : isMid
          ? TICK_HEIGHT.mid
          : TICK_HEIGHT.minor;
    const x = roundPx(index * pxPerTick);

    ticks.push({
      x,
      height: baseHeight + Math.round(near * GLOW_HEIGHT_BONUS),
      kind: isCurrent ? 'current' : isMajor ? 'major' : 'minor',
      glowPercent:
        !isCurrent && near > GLOW_THRESHOLD
          ? Math.round((GLOW_ALPHA_BASE + GLOW_ALPHA_RANGE * near) * PERCENT)
          : null,
    });

    if (tickNumber % labelEvery === 0) {
      labels.push({ x, text: options.labelFormatter(tickValue) });
    }
  }

  return { ticks, labels, offset: roundPx(-valueTicks * pxPerTick) };
}
