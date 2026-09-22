import { FigureBandTone } from '../../../../shared/components/figure';
import { roundTo } from '../../../../core/utils/math';

/**
 * The weight scene's particles and tones – a port of the design's `vfig`.
 *
 * `progressKg` is the design's `good`: how many kilos the draft has moved in the right direction.
 * The greater the progress, the more sweat drops, the bigger the puddle, the darker the
 * headband – and from 2.5 kg, steam above the head. All numbers are SVG units in `viewBox="0 0 200 300"`.
 */
export interface SweatDrop {
  readonly x: number;
  readonly y: number;
  /** The drop's duration in seconds. */
  readonly duration: number;
  readonly delay: number;
}

export interface SteamPuff {
  readonly x: number;
  readonly y: number;
  readonly delay: number;
}

export type SparkTone = 'accent' | 'positive' | 'selected';

export interface SaveSpark {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly tone: SparkTone;
  /** Ready-made BEM modifier for the spark, so the template avoids building the class name. */
  readonly toneClass: string;
}

export interface PuddleSize {
  readonly rx: number;
  readonly ry: number;
}

/** Mood saturates at 1.5 kg progress. */
const MOOD_SCALE_KG = 1.5;
/** One sweat drop per 0.2 kg progress, at most ten. */
const SWEAT_PER_KG = 0.2;
const MAX_SWEAT_DROPS = 10;
/** Sweat is drawn outside the figure's `translate(0 -8)`, so the points move with it. */
const SWEAT_Y_OFFSET = -8;
const PUDDLE_RX_PER_KG = 14;
const PUDDLE_RX_MAX = 52;
const PUDDLE_RY_PER_KG = 1.4;
const PUDDLE_RY_MAX = 5;
/** Steam from 2.5 kg progress. */
const STEAM_FROM_KG = 2.5;
/** The steam's tempo in seconds (design's `steam 1.8s`). */
export const STEAM_DURATION_SECONDS = 1.8;
/** The headband darkens at 0.5 and 1 kg progress. */
const BAND_STRONG_FROM_KG = 0.5;
const BAND_DEEP_FROM_KG = 1;
/** The pupils look 1.6 units sideways and 2.2 down while the weight changes. */
export const PUPIL_LOOK_X = 1.6;
export const PUPIL_LOOK_Y = 2.2;
/** The figure jumps 34 units up when the weigh-in is saved. */
export const SAVE_JUMP_Y = -34;
/** The scene's canvas in CSS pixels (design's 150 × 236). Bound as local variables. */
export const SCENE_WIDTH_PX = 150;
export const SCENE_HEIGHT_PX = 236;

function positive(progressKg: number): number {
  return Math.max(0, progressKg);
}

/** −1 (sad) … 0 … 1 (happy). */
export function sceneMood(progressKg: number): number {
  return Math.max(-1, Math.min(1, progressKg / MOOD_SCALE_KG));
}

export function sceneBandTone(progressKg: number): FigureBandTone {
  if (progressKg >= BAND_DEEP_FROM_KG) {
    return 'accent-deep';
  }
  if (progressKg >= BAND_STRONG_FROM_KG) {
    return 'accent-strong';
  }
  return 'accent';
}

/** The design's ten sweat spots, positioned relative to head and body. */
export function sweatDrops(progressKg: number, headY: number, bodyY: number): readonly SweatDrop[] {
  const count = Math.min(MAX_SWEAT_DROPS, Math.floor(positive(progressKg) / SWEAT_PER_KG));
  const spots: readonly (readonly [number, number])[] = [
    [72, headY - 20],
    [128, headY - 16],
    [66, headY - 2],
    [134, headY + 4],
    [78, bodyY + 4],
    [122, bodyY + 8],
    [60, headY + 14],
    [140, headY + 18],
    [90, bodyY + 30],
    [112, bodyY + 34],
  ];
  return spots.slice(0, count).map(([x, y], index) => ({
    x: roundTo(x, 1),
    y: roundTo(y + SWEAT_Y_OFFSET, 1),
    duration: roundTo(1.1 + (index % 3) * 0.35, 1),
    delay: roundTo(index * 0.23, 1),
  }));
}

export function puddleSize(progressKg: number): PuddleSize {
  const progress = positive(progressKg);
  return {
    rx: roundTo(Math.min(PUDDLE_RX_MAX, progress * PUDDLE_RX_PER_KG), 1),
    ry: roundTo(Math.min(PUDDLE_RY_MAX, progress * PUDDLE_RY_PER_KG), 1),
  };
}

export function steamPuffs(progressKg: number, headY: number): readonly SteamPuff[] {
  if (progressKg < STEAM_FROM_KG) {
    return [];
  }
  return [
    { x: 80, y: roundTo(headY - 30, 1), delay: 0 },
    { x: 100, y: roundTo(headY - 34, 1), delay: 0.6 },
    { x: 120, y: roundTo(headY - 30, 1), delay: 1.2 },
  ];
}

/** The five sparks that flash when the weigh-in is saved. */
export const SAVE_SPARKS: readonly SaveSpark[] = [
  { x: 40, y: 120, radius: 4, tone: 'accent', toneClass: 'weight-scale-scene__spark--accent' },
  { x: 165, y: 100, radius: 3, tone: 'positive', toneClass: 'weight-scale-scene__spark--positive' },
  { x: 60, y: 60, radius: 3, tone: 'selected', toneClass: 'weight-scale-scene__spark--selected' },
  { x: 150, y: 160, radius: 4, tone: 'accent', toneClass: 'weight-scale-scene__spark--accent' },
  { x: 100, y: 30, radius: 3, tone: 'positive', toneClass: 'weight-scale-scene__spark--positive' },
];

/** The sweat drop's shape (design's `drip` path). */
export function sweatPath(drop: SweatDrop): string {
  return `M${drop.x} ${drop.y} c -3 4 -3 6 -3 7 a 3 3 0 0 0 6 0 c 0 -1 0 -3 -3 -7 z`;
}

/** The steam's winding line. */
export function steamPath(puff: SteamPuff): string {
  return `M${puff.x} ${puff.y} q 4 -6 0 -12 q -4 -6 0 -12`;
}
