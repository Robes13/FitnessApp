import { WeightChartPoint, computeWeightChartGeometry } from './weight-chart-geometry';

/** Points spread evenly from the range's start to now. */
function evenly(...valuesKg: number[]): WeightChartPoint[] {
  return valuesKg.map((kg, index) => ({ kg, position: index / (valuesKg.length - 1) }));
}

describe('computeWeightChartGeometry', () => {
  it('går fra intervallets start til nu og skalerer efter punkter og mållinje', () => {
    const geometry = computeWeightChartGeometry(evenly(70, 72), 71);

    expect(geometry.linePath).toBe('M0 85 L320 25');
    expect(geometry.areaPath).toBe('M0 85 L320 25 L320 100 L0 100 Z');
    expect(geometry.goalLineY).toBe(55);
    expect(geometry.lastX).toBe(320);
    expect(geometry.lastY).toBe(25);
  });

  it('placerer hver vejning på sin dato, ikke efter nummer', () => {
    // "1 uge": weighed 5, 2 and 0 days ago.
    const geometry = computeWeightChartGeometry(
      [
        { kg: 70, position: 2 / 7 },
        { kg: 71, position: 5 / 7 },
        { kg: 72, position: 1 },
      ],
      70,
    );

    expect(geometry.linePath).toBe('M91.4 85 L228.6 55 L320 25');
  });

  it('lukker fladen ved første og sidste vejning og sætter endeprikken på den sidste', () => {
    const geometry = computeWeightChartGeometry(
      [
        { kg: 70, position: 0.25 },
        { kg: 72, position: 0.5 },
      ],
      71,
    );

    expect(geometry.areaPath).toBe('M80 85 L160 25 L160 100 L80 100 Z');
    expect(geometry.lastX).toBe(160);
    expect(geometry.lastY).toBe(25);
  });

  it('tager målvægten med i skalaen, også når den ligger uden for kurven', () => {
    const geometry = computeWeightChartGeometry(evenly(80, 80), 60);

    expect(geometry.goalLineY).toBeGreaterThan(geometry.lastY);
    expect(geometry.goalLineY).toBeLessThanOrEqual(100);
  });

  it('giver en tom geometri, når der er under to punkter', () => {
    expect(computeWeightChartGeometry([], 70).linePath).toBe('');
    expect(computeWeightChartGeometry(evenly(70), 70).linePath).toBe('');
    expect(computeWeightChartGeometry(evenly(70), 70).areaPath).toBe('');
  });
});
