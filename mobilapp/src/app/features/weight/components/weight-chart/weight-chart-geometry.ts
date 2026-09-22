import { roundTo } from '../../../../core/utils/math';

/**
 * Vægtgrafens geometri – en port af designets `pts` / `linePath` / `areaPath` / `goalLineY`.
 *
 * Alle tal er SVG-enheder i `viewBox="0 0 320 110"`: kurven fylder x 0–320 og y 10–100, og de
 * nederste 10 enheder er luft til den afrundede endeprik. Skalaen strækkes altid, så både alle
 * punkter og mållinjen er med (±0,5 kg luft).
 */
export interface WeightChartGeometry {
  /** `M…L…` gennem alle punkter. */
  readonly linePath: string;
  /** Samme kurve lukket ned til bundlinjen – fyldes med gradienten. */
  readonly areaPath: string;
  /** Den stiplede mållinjes y. */
  readonly goalLineY: number;
  /** Endeprikkens position (sidste punkt). */
  readonly lastX: number;
  readonly lastY: number;
}

export const WEIGHT_CHART_WIDTH = 320;
export const WEIGHT_CHART_HEIGHT = 110;

/** Kurvens bundlinje i viewBox'en. */
const BASELINE_Y = 100;
/** Kurvens lodrette udstrækning. */
const PLOT_HEIGHT = 90;
/** Luft over og under yderpunkterne, så kurven ikke rører kanten. */
const PADDING_KG = 0.5;
/** Én decimal i path-data holder DOM'en læsbar. */

const EMPTY_GEOMETRY: WeightChartGeometry = {
  linePath: '',
  areaPath: '',
  goalLineY: BASELINE_Y,
  lastX: WEIGHT_CHART_WIDTH,
  lastY: BASELINE_Y,
};

export function computeWeightChartGeometry(
  valuesKg: readonly number[],
  goalKg: number,
): WeightChartGeometry {
  const lastIndex = valuesKg.length - 1;
  const lastValue = valuesKg[lastIndex];
  if (valuesKg.length < 2 || lastValue === undefined) {
    return EMPTY_GEOMETRY;
  }

  const min = Math.min(...valuesKg, goalKg) - PADDING_KG;
  const max = Math.max(...valuesKg, goalKg) + PADDING_KG;
  const x = (index: number): number => roundTo((index / lastIndex) * WEIGHT_CHART_WIDTH, 1);
  const y = (kg: number): number =>
    roundTo(BASELINE_Y - ((kg - min) / (max - min)) * PLOT_HEIGHT, 1);

  const linePath = valuesKg
    .map((kg, index) => `${index ? 'L' : 'M'}${x(index)} ${y(kg)}`)
    .join(' ');

  return {
    linePath,
    areaPath: `${linePath} L${WEIGHT_CHART_WIDTH} ${BASELINE_Y} L0 ${BASELINE_Y} Z`,
    goalLineY: y(goalKg),
    lastX: WEIGHT_CHART_WIDTH,
    lastY: y(lastValue),
  };
}
