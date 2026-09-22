import { FigureBandTone } from '../../../../shared/components/figure';
import { roundTo } from '../../../../core/utils/math';

/**
 * Vægt-scenens partikler og toner – en port af designets `vfig`.
 *
 * `progressKg` er designets `good`: hvor mange kilo kladden er kommet i den rigtige retning.
 * Jo større fremgang, desto flere sveddråber, større vandpyt, mørkere pandebånd – og fra
 * 2,5 kg damp over hovedet. Alle tal er SVG-enheder i `viewBox="0 0 200 300"`.
 */
export interface SweatDrop {
  readonly x: number;
  readonly y: number;
  /** Dryppets varighed i sekunder. */
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
  /** Færdig BEM-modifier til gnisten, så templaten slipper for at bygge klassenavnet. */
  readonly toneClass: string;
}

export interface PuddleSize {
  readonly rx: number;
  readonly ry: number;
}

/** Humøret mættes ved 1,5 kg fremgang. */
const MOOD_SCALE_KG = 1.5;
/** Én sveddråbe pr. 0,2 kg fremgang, højst ti. */
const SWEAT_PER_KG = 0.2;
const MAX_SWEAT_DROPS = 10;
/** Sveden tegnes uden for figurens `translate(0 -8)`, så punkterne er flyttet med. */
const SWEAT_Y_OFFSET = -8;
const PUDDLE_RX_PER_KG = 14;
const PUDDLE_RX_MAX = 52;
const PUDDLE_RY_PER_KG = 1.4;
const PUDDLE_RY_MAX = 5;
/** Damp fra 2,5 kg fremgang. */
const STEAM_FROM_KG = 2.5;
/** Dampens tempo i sekunder (designets `steam 1.8s`). */
export const STEAM_DURATION_SECONDS = 1.8;
/** Pandebåndet mørknes ved 0,5 og 1 kg fremgang. */
const BAND_STRONG_FROM_KG = 0.5;
const BAND_DEEP_FROM_KG = 1;
/** Pupillerne kigger 1,6 enheder til siden og 2,2 ned, mens vægten ændres. */
export const PUPIL_LOOK_X = 1.6;
export const PUPIL_LOOK_Y = 2.2;
/** Figuren hopper 34 enheder op, når vejningen er gemt. */
export const SAVE_JUMP_Y = -34;
/** Scenens tegneflade i CSS-pixel (designets 150 × 236). Bindes som lokale variabler. */
export const SCENE_WIDTH_PX = 150;
export const SCENE_HEIGHT_PX = 236;

function positive(progressKg: number): number {
  return Math.max(0, progressKg);
}

/** −1 (ked af det) … 0 … 1 (glad). */
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

/** Designets ti svedpunkter, placeret i forhold til hoved og krop. */
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

/** De fem gnister, der blinker, når vejningen gemmes. */
export const SAVE_SPARKS: readonly SaveSpark[] = [
  { x: 40, y: 120, radius: 4, tone: 'accent', toneClass: 'weight-scale-scene__spark--accent' },
  { x: 165, y: 100, radius: 3, tone: 'positive', toneClass: 'weight-scale-scene__spark--positive' },
  { x: 60, y: 60, radius: 3, tone: 'selected', toneClass: 'weight-scale-scene__spark--selected' },
  { x: 150, y: 160, radius: 4, tone: 'accent', toneClass: 'weight-scale-scene__spark--accent' },
  { x: 100, y: 30, radius: 3, tone: 'positive', toneClass: 'weight-scale-scene__spark--positive' },
];

/** Sveddråbens form (designets `drip`-path). */
export function sweatPath(drop: SweatDrop): string {
  return `M${drop.x} ${drop.y} c -3 4 -3 6 -3 7 a 3 3 0 0 0 6 0 c 0 -1 0 -3 -3 -7 z`;
}

/** Dampens slyngede streg. */
export function steamPath(puff: SteamPuff): string {
  return `M${puff.x} ${puff.y} q 4 -6 0 -12 q -4 -6 0 -12`;
}
