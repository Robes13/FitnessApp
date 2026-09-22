import { clamp, roundTo } from '../../../../../../core/utils/math';

/**
 * Kagens geometri i figur-SVG'ets koordinatsystem (`viewBox 0 0 260 300`).
 * Direkte port af designets `cakeLayers` og `candles`: antallet af lag følger alderen,
 * og ét lys pr. år (op til 25) fordeles på op til tre koncentriske ringe på kagens top.
 */

export interface CakeTier {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Glasurens sti: kagens overkant plus en bue pr. "tunge". */
  readonly drip: string;
  readonly tierClass: string;
  readonly icingClass: string;
}

export interface CakeCandle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly stripeY: number;
  readonly centreX: number;
  /** Midten af det bløde skær om flammen. */
  readonly glowY: number;
  readonly flamePath: string;
  readonly corePath: string;
  readonly colourClass: string;
  /** Forskudt animation i sekunder, så lysene ikke blafrer i takt. */
  readonly delay: number;
}

export interface CakeGeometry {
  readonly tiers: number;
  /** Y for kagens øverste flade – lysene står her. */
  readonly top: number;
  readonly layers: readonly CakeTier[];
  readonly surfaceRx: number;
  readonly surfaceRxInner: number;
  readonly numberY: number;
  readonly candles: readonly CakeCandle[];
}

const CENTRE_X = 204;
const BASE_Y = 282;
const TIER_HEIGHT = 28;
const BASE_WIDTH = 116;
const TIER_INSET = 16;
const ICING_DROP = 8;
const SCALLOP_DEPTH = 9;
const SCALLOP_WIDTH = 14;
const MIN_SCALLOPS = 4;
const SURFACE_INSET = 3;
const SURFACE_INNER_INSET = 7;
const NUMBER_OFFSET_Y = 40;

const TIER_CLASSES = ['dark', 'brown', 'dark'] as const;
const ICING_CLASSES = ['accent', 'accent-light', 'accent'] as const;

/** Aldersgrænserne for antal lag: under 20 ét, under 50 to, derover tre. */
const TWO_TIER_AGE = 20;
const THREE_TIER_AGE = 50;
/** Flere end 25 lys får ikke plads på kagen – så står tallet der i stedet. */
export const MAX_CANDLES = 25;
export const CAKE_NUMBER_MIN_AGE = 40;
const RING_CAPS = [12, 8, 5] as const;
const RING_SHRINK = 0.42;
const RING_RY = 7;
const CANDLE_WIDTH = 4;
const CANDLE_RADIUS = 2;
const CANDLE_BASE_HEIGHT = 15;
const CANDLE_STRIPE_OFFSET = 5;
const FLAME_OFFSET = 6;
const CANDLE_COLOUR_COUNT = 5;
const DELAY_STEP = 0.11;

/** Designet skriver kagens mål med én decimal. */
const DECIMALS = 1;

export function cakeTierCount(age: number): number {
  if (age < TWO_TIER_AGE) {
    return 1;
  }
  return age < THREE_TIER_AGE ? 2 : 3;
}

function buildLayers(tiers: number): readonly CakeTier[] {
  return Array.from({ length: tiers }, (_unused, index) => {
    const width = BASE_WIDTH - index * TIER_INSET;
    const x = CENTRE_X - width / 2;
    const y = BASE_Y - (index + 1) * TIER_HEIGHT;
    const scallops = Math.max(MIN_SCALLOPS, Math.round(width / SCALLOP_WIDTH));
    const half = (width / scallops / 2).toFixed(DECIMALS);
    const full = (width / scallops).toFixed(DECIMALS);
    const curve = Array.from(
      { length: scallops },
      () => `q -${half} ${SCALLOP_DEPTH} -${full} 0`,
    ).join(' ');
    return {
      x: roundTo(x, 1),
      y,
      width,
      height: TIER_HEIGHT,
      drip: `M${x.toFixed(DECIMALS)} ${y} h ${width} v ${ICING_DROP} ${curve} z`,
      tierClass: `birthday-cake__tier--${TIER_CLASSES[index] ?? TIER_CLASSES[0]}`,
      icingClass: `birthday-cake__icing--${ICING_CLASSES[index] ?? ICING_CLASSES[0]}`,
    };
  });
}

/** Lysene fordelt på 1–3 ringe; det yderste lag tegnes bagest (sorteret på y). */
function buildCandles(age: number, top: number, surfaceRx: number): readonly CakeCandle[] {
  const total = clamp(age, 0, MAX_CANDLES);
  if (total === 0) {
    return [];
  }

  const rings: number[] = [];
  let left = total;
  for (const cap of RING_CAPS) {
    if (left <= 0) {
      break;
    }
    const take = Math.min(cap, left);
    rings.push(take);
    left -= take;
  }
  // Et enkelt lys alene i den inderste ring ser forkert ud – lån ét fra ringen udenfor.
  const last = rings.length - 1;
  const outer = rings[last - 1];
  if (rings.length > 1 && rings[last] === 1 && outer !== undefined) {
    rings[last - 1] = outer - 1;
    rings[last] = 2;
  }

  const candles: (CakeCandle & { readonly sortY: number })[] = [];
  rings.forEach((count, ring) => {
    const shrink = rings.length === 1 ? 1 : 1 - ring * RING_SHRINK;
    const rx = surfaceRx * shrink;
    const ry = RING_RY * shrink;
    for (let index = 0; index < count; index++) {
      const angle = (Math.PI * 2 * index) / count + (ring % 2 ? Math.PI / count : 0) + Math.PI / 2;
      const centreX = CENTRE_X + rx * Math.cos(angle);
      const footY = top + ry * Math.sin(angle);
      const height = CANDLE_BASE_HEIGHT - ring;
      const topY = footY - height;
      const flameY = roundTo(topY, 1);
      const cx = roundTo(centreX, 1);
      candles.push({
        x: roundTo(centreX - CANDLE_WIDTH / 2, 1),
        y: flameY,
        width: CANDLE_WIDTH,
        height,
        radius: CANDLE_RADIUS,
        stripeY: roundTo(topY + CANDLE_STRIPE_OFFSET, 1),
        centreX: cx,
        glowY: roundTo(topY - FLAME_OFFSET, 1),
        flamePath: `M${cx} ${flameY} c -3 -3 -3 -7 0 -10 c 3 3 3 7 0 10 z`,
        corePath: `M${cx} ${flameY} c -1.3 -1.6 -1.3 -3.6 0 -5.2 c 1.3 1.6 1.3 3.6 0 5.2 z`,
        colourClass: `birthday-cake__candle--${(ring + index) % CANDLE_COLOUR_COUNT}`,
        delay: Math.round(((index + ring) % CANDLE_COLOUR_COUNT) * DELAY_STEP * 100) / 100,
        sortY: footY,
      });
    }
  });

  return candles.sort((a, b) => a.sortY - b.sortY);
}

export function computeCakeGeometry(age: number): CakeGeometry {
  const tiers = age <= 0 ? 1 : cakeTierCount(age);
  const top = BASE_Y - tiers * TIER_HEIGHT;
  const topWidth = BASE_WIDTH - (tiers - 1) * TIER_INSET;
  const surfaceRx = topWidth / 2;
  return {
    tiers,
    top,
    layers: buildLayers(tiers),
    surfaceRx: roundTo(surfaceRx, 1),
    surfaceRxInner: roundTo(surfaceRx - SURFACE_INNER_INSET, 1),
    numberY: top + NUMBER_OFFSET_Y,
    candles: buildCandles(age, top, surfaceRx - SURFACE_INSET),
  };
}
