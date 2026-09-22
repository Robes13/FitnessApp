import { roundTo } from '../../../core/utils/math';

/**
 * The ruler's geometry – a generic port of the design's `ruler(min, max, val, step, bleed)` and
 * `stepRuler(val, bleed)`. One tick per `tickUnit` (1 kg, 1 cm, 100 steps …), `pxPerTick`
 * pixels between ticks; every 5th/10th tick is mid/major, and the ticks near the current value
 * "glow" orange with a strength that falls off over `reach` ticks and scales with `bleed`.
 */
export type RulerTickKind = 'current' | 'major' | 'minor';

export interface RulerTick {
  /** Distance from the ruler's zero point in px. */
  readonly x: number;
  /** Tick height in px (base height + glow bonus). */
  readonly height: number;
  readonly kind: RulerTickKind;
  /** The glow's strength in percent for `color-mix`, or `null` when the tick has its base color. */
  readonly glowPercent: number | null;
}

export interface RulerLabel {
  readonly x: number;
  readonly text: string;
}

export interface RulerGeometry {
  readonly ticks: readonly RulerTick[];
  readonly labels: readonly RulerLabel[];
  /** The track's horizontal offset in px, so the current value sits under the center line. */
  readonly offset: number;
}

export type RulerLabelFormatter = (tickValue: number) => string;

export interface RulerGeometryOptions {
  readonly min: number;
  readonly max: number;
  readonly value: number;
  /** Value per tick. */
  readonly tickUnit: number;
  /** Pixels per tick. */
  readonly pxPerTick: number;
  /** Every nth tick (in absolute tick numbers) is major. */
  readonly majorEvery: number;
  /** Every nth tick is mid-height. */
  readonly midEvery: number;
  /** Every nth tick gets a label. */
  readonly labelEvery: number;
  /** The glow's maximum strength (0..1): 0.35 at rest, 1 while dragging. */
  readonly bleed: number;
  /** How many ticks the glow reaches on each side. */
  readonly reach: number;
  readonly labelFormatter: RulerLabelFormatter;
}

/** Glow at rest (the design's default for `ruler()`). */
export const RULER_BLEED_IDLE = 0.35;
/** Glow at rest on the weight, height and step rulers (the design's 0.4). */
export const RULER_BLEED_IDLE_STRONG = 0.4;
/** Glow while the user is dragging. */
export const RULER_BLEED_DRAGGING = 1;
/** The design's `reach` for kg/cm rulers (the step ruler uses 8). */
export const RULER_DEFAULT_GLOW_REACH = 6;

const TICK_HEIGHT = { current: 34, major: 28, mid: 18, minor: 10 } as const;
const GLOW_HEIGHT_BONUS = 9;
const GLOW_THRESHOLD = 0.06;
const GLOW_ALPHA_BASE = 0.3;
const GLOW_ALPHA_RANGE = 0.7;
const PERCENT = 100;
const EPSILON = 1e-9;

const EMPTY_GEOMETRY: RulerGeometry = { ticks: [], labels: [], offset: 0 };

/** Default label: the value as-is. */
export function formatRulerLabel(tickValue: number): string {
  return String(tickValue);
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
    const x = roundTo(index * pxPerTick, 2);

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

  return { ticks, labels, offset: roundTo(-valueTicks * pxPerTick, 2) };
}
