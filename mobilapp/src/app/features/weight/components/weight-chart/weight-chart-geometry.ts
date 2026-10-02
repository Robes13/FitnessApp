import { roundTo } from '../../../../core/utils/math';

/**
 * The weight chart's geometry – a port of the design's `pts` / `linePath` / `areaPath` / `goalLineY`.
 *
 * All numbers are SVG units in `viewBox="0 0 320 110"`: x 0–320 is the range's time axis (its start
 * to now – the footer's "-3 uger" … "I dag"), so each weigh-in sits at its date; y 10–100 is the
 * weight, and the bottom 10 units are room for the rounded end dot. The scale always stretches so
 * both all points and the goal line are included (±0.5 kg padding).
 */
export interface WeightChartGeometry {
  /** `M…L…` through all points. */
  readonly linePath: string;
  /** The same curve closed down to the baseline – filled with the gradient. */
  readonly areaPath: string;
  /** The y of the dashed goal line. */
  readonly goalLineY: number;
  /** The end dot's position (the newest weigh-in). */
  readonly lastX: number;
  readonly lastY: number;
}

/** A weigh-in on the chart. `WeightPoint` from `WeightLogService.seriesFor()` fits. */
export interface WeightChartPoint {
  readonly kg: number;
  /** Where the weigh-in sits on the range's time axis: 0 = the range's start, 1 = now. */
  readonly position: number;
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
  points: readonly WeightChartPoint[],
  goalKg: number,
): WeightChartGeometry {
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length < 2 || first === undefined || last === undefined) {
    return EMPTY_GEOMETRY;
  }

  const valuesKg = points.map((point) => point.kg);
  const min = Math.min(...valuesKg, goalKg) - PADDING_KG;
  const max = Math.max(...valuesKg, goalKg) + PADDING_KG;
  const x = (position: number): number => roundTo(position * WEIGHT_CHART_WIDTH, 1);
  const y = (kg: number): number =>
    roundTo(BASELINE_Y - ((kg - min) / (max - min)) * PLOT_HEIGHT, 1);

  const linePath = points
    .map((point, index) => `${index ? 'L' : 'M'}${x(point.position)} ${y(point.kg)}`)
    .join(' ');
  const lastX = x(last.position);

  return {
    linePath,
    areaPath: `${linePath} L${lastX} ${BASELINE_Y} L${x(first.position)} ${BASELINE_Y} Z`,
    goalLineY: y(goalKg),
    lastX,
    lastY: y(last.kg),
  };
}
