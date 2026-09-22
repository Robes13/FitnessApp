import { roundTo } from '../../../../core/utils/math';

/**
 * The weight chart's geometry – a port of the design's `pts` / `linePath` / `areaPath` / `goalLineY`.
 *
 * All numbers are SVG units in `viewBox="0 0 320 110"`: the curve fills x 0–320 and y 10–100, and
 * the bottom 10 units are room for the rounded end dot. The scale always stretches so both all
 * points and the goal line are included (±0.5 kg padding).
 */
export interface WeightChartGeometry {
  /** `M…L…` through all points. */
  readonly linePath: string;
  /** The same curve closed down to the baseline – filled with the gradient. */
  readonly areaPath: string;
  /** The y of the dashed goal line. */
  readonly goalLineY: number;
  /** The end dot's position (last point). */
  readonly lastX: number;
  readonly lastY: number;
}

export const WEIGHT_CHART_WIDTH = 320;
export const WEIGHT_CHART_HEIGHT = 110;

/** The curve's baseline in the viewBox. */
const BASELINE_Y = 100;
/** The curve's vertical extent. */
const PLOT_HEIGHT = 90;
/** Padding above and below the outer points, so the curve doesn't touch the edge. */
const PADDING_KG = 0.5;
/** One decimal in the path data keeps the DOM readable. */

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
