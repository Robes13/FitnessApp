import { clamp, roundTo } from '../../../core/utils/math';

/**
 * The figure's (mascot's) geometry – an exact port of the design's `figure(w, h, mood)`.
 *
 * All measurements are SVG units in a `viewBox="0 0 200 300"`: the figure stands centered on
 * x = 100 with the shoes on the floor at y ≈ 290. Weight drives the width, height drives legs
 * and torso, and `mood` (−1 sad … 0 neutral … 1 happy) drives the smile and how high the right
 * arm lifts the dumbbell.
 *
 * The numeric constants are the design's own tuning values and are not changed – the spec locks the output.
 */
export interface FigureGeometry {
  readonly legH: number;
  readonly legY: number;
  readonly legLX: number;
  readonly legRX: number;
  readonly shoeLX: number;
  readonly shoeRX: number;
  readonly bodyX: number;
  readonly bodyY: number;
  readonly bodyW: number;
  readonly bodyH: number;
  readonly bodyRx: number;
  readonly beltX: number;
  readonly beltY: number;
  readonly beltW: number;
  /** SVG path for the left arm. */
  readonly armL: string;
  /** SVG path for the right arm (lifts the dumbbell at positive `mood`). */
  readonly armR: string;
  readonly dbX: number;
  readonly dbY: number;
  readonly dbCapY: number;
  readonly dbCapRX: number;
  readonly headY: number;
  readonly bandY: number;
  readonly eyeY: number;
  readonly cheekY: number;
  /** SVG path for the mouth as a line (smile or frown). */
  readonly smile: string;
  readonly shadowRx: number;
  /** 1 when the smile is shown, 0 when the open mouth (≥ 180 kg) takes over. */
  readonly smileOp: number;
  readonly mouthY: number;
  readonly mouthRx: number;
  readonly mouthRy: number;
  readonly tongueRx: number;
  readonly tongueRy: number;
  readonly browY: number;
  readonly browRot: number;
  readonly browRotR: number;
  readonly browOp: number;
  /** 0..1 – how clearly the ceiling and lamp are shown (from 212 cm). */
  readonly ceilOp: number;
  readonly ceilY: number;
  readonly lampY: number;
  readonly lampY2: number;
  readonly lampRot: number;
  /** The head's tilt in degrees when the figure ducks under the ceiling (from 230 cm). */
  readonly headRot: number;
  /** The hand's y position – used by scenes that draw their own arms or props. */
  readonly handY: number;
}

/** The floor line in the figure's viewBox. */
const FLOOR_Y = 290;
/** The figure's centerline. */
const CENTRE_X = 100;
/** The head's radius. */
const HEAD_RADIUS = 26;
/** The ceiling's y position (the ceiling is shown from 212 cm). */
const CEILING_Y = 92;

/**
 * Computes the figure's geometry from weight (kg), height (cm) and mood (−1..1).
 * Exact port of the design's `figure(w, h, mood)`; see `figure-geometry.spec.ts` for the locked values.
 */
export function computeFigureGeometry(
  weightKg: number,
  heightCm: number,
  mood = 0,
): FigureGeometry {
  const m = mood || 0;
  const legH = Math.round(Math.max(14, 38 + (heightCm - 120) * 0.38));
  const torsoH = Math.round(Math.max(34, 60 + (heightCm - 120) * 0.27));
  const bodyW = Math.round(Math.max(46, Math.min(190, 34 + (weightKg - 30) * 0.58)));
  const legY = FLOOR_Y - legH;
  const bodyY = legY - torsoH + 12;
  const bodyX = CENTRE_X - bodyW / 2;
  const legGap = Math.min(bodyW / 4, 26);
  const ceilY = CEILING_Y;
  let headY = bodyY - 14;
  if (headY - HEAD_RADIUS < ceilY) {
    headY = ceilY + HEAD_RADIUS + (headY - HEAD_RADIUS - ceilY) * 0.15;
  }
  const handY = bodyY + torsoH * 0.72;
  /** All derived measurements are rounded to one decimal, as the design does. */
  const r = (value: number): number => roundTo(value, 1);
  const lift = Math.max(0, m) * (torsoH * 0.9);
  const open = clamp((weightKg - 180) / 60, 0, 1);
  const duck = clamp((heightCm - 230) / 20, 0, 1);
  const ceilNear = clamp((heightCm - 212) / 15, 0, 1);

  const smile =
    m < 0
      ? `M91 ${r(headY + 15)} Q100 ${r(headY + 15 - 9 * -m)} 109 ${r(headY + 15)}`
      : `M91 ${r(headY + 9)} Q100 ${r(headY + 18 + 4 * m)} 109 ${r(headY + 9)}`;

  return {
    legH,
    legY,
    legLX: r(CENTRE_X - legGap - 10),
    legRX: r(CENTRE_X + legGap - 10),
    shoeLX: r(CENTRE_X - legGap - 16),
    shoeRX: r(CENTRE_X + legGap - 14),
    bodyX: r(bodyX),
    bodyY: r(bodyY),
    bodyW,
    bodyH: torsoH,
    bodyRx: Math.min(bodyW / 2, 42),
    beltX: r(bodyX - 3),
    beltY: r(bodyY + torsoH * 0.6),
    beltW: bodyW + 6,
    armL: `M${r(bodyX + 10)} ${r(bodyY + 22)} Q${r(bodyX - 16)} ${r(bodyY + 44)} ${r(bodyX - 8)} ${r(handY)}`,
    armR: `M${r(bodyX + bodyW - 10)} ${r(bodyY + 22)} Q${r(bodyX + bodyW + 22)} ${r(bodyY + 44 - lift * 0.6)} ${r(bodyX + bodyW + 8)} ${r(handY - lift)}`,
    dbX: r(bodyX + bodyW - 12),
    dbY: r(handY - 3 - lift),
    dbCapY: r(handY - 10 - lift),
    dbCapRX: r(bodyX + bodyW + 19),
    headY: r(headY),
    bandY: r(headY - 14),
    eyeY: r(headY - 1),
    cheekY: r(headY + 9),
    smile,
    shadowRx: r(bodyW / 2 + 12),
    smileOp: open > 0 ? 0 : 1,
    mouthY: r(headY + 11),
    mouthRx: r(open * 9),
    mouthRy: r(open * 8),
    tongueRx: r(open * 5),
    tongueRy: r(open * 3.5),
    browY: r(headY - 11),
    browRot: r(-18 * open),
    browRotR: r(18 * open),
    browOp: open > 0 ? 1 : 0,
    ceilOp: ceilNear,
    ceilY,
    lampY: r(ceilY + 14),
    lampY2: r(ceilY + 30),
    lampRot: r(-28 * duck),
    headRot: r(-26 * duck),
    handY: r(handY),
  };
}
