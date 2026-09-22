/**
 * Figurens (maskottens) geometri – en nøjagtig port af designets `figure(w, h, mood)`.
 *
 * Alle mål er SVG-enheder i en `viewBox="0 0 200 300"`: figuren står centreret om x = 100 med
 * skoene på gulvet ved y ≈ 290. Vægten styrer bredden, højden styrer ben og torso, og `mood`
 * (−1 ked af det … 0 neutral … 1 glad) styrer smilet og hvor højt højre arm løfter håndvægten.
 *
 * Talkonstanterne er designets egne tuningværdier og ændres ikke – specs'en låser outputtet.
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
  /** SVG-path for venstre arm. */
  readonly armL: string;
  /** SVG-path for højre arm (løfter håndvægten ved positiv `mood`). */
  readonly armR: string;
  readonly dbX: number;
  readonly dbY: number;
  readonly dbCapY: number;
  readonly dbCapRX: number;
  readonly headY: number;
  readonly bandY: number;
  readonly eyeY: number;
  readonly cheekY: number;
  /** SVG-path for munden som streg (smil eller sur mund). */
  readonly smile: string;
  readonly shadowRx: number;
  /** 1 når smilet vises, 0 når den åbne mund (≥ 180 kg) tager over. */
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
  /** 0..1 – hvor tydeligt loftet og lampen vises (fra 212 cm). */
  readonly ceilOp: number;
  readonly ceilY: number;
  readonly lampY: number;
  readonly lampY2: number;
  readonly lampRot: number;
  /** Hovedets hældning i grader, når figuren dukker sig under loftet (fra 230 cm). */
  readonly headRot: number;
  /** Håndens y-position – bruges af scener, der tegner egne arme eller rekvisitter. */
  readonly handY: number;
}

/** Gulvlinjen i figurens viewBox. */
const FLOOR_Y = 290;
/** Figurens midterlinje. */
const CENTRE_X = 100;
/** Hovedets radius. */
const HEAD_RADIUS = 26;
/** Loftets y-position (loftet vises fra 212 cm). */
const CEILING_Y = 92;

/**
 * Runder til én decimal, som designet gør for alle udledte mål. `+ 0` normaliserer `-0`
 * (fx `-28 * 0`) til `0`, så værdierne kan sammenlignes strengt; SVG-attributten er den samme.
 */
function roundTenth(value: number): number {
  return Math.round(value * 10) / 10 + 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Beregner figurens geometri ud fra vægt (kg), højde (cm) og humør (−1..1).
 * Eksakt port af designets `figure(w, h, mood)`; se `figure-geometry.spec.ts` for låste værdier.
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
  const r = roundTenth;
  const lift = Math.max(0, m) * (torsoH * 0.9);
  const open = clamp01((weightKg - 180) / 60);
  const duck = clamp01((heightCm - 230) / 20);
  const ceilNear = clamp01((heightCm - 212) / 15);

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
