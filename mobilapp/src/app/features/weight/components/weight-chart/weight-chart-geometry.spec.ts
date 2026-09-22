import { computeWeightChartGeometry } from './weight-chart-geometry';

describe('computeWeightChartGeometry', () => {
  it('strækker kurven over hele bredden og skalerer efter punkter og mållinje', () => {
    const geometry = computeWeightChartGeometry([70, 72], 71);

    expect(geometry.linePath).toBe('M0 85 L320 25');
    expect(geometry.areaPath).toBe('M0 85 L320 25 L320 100 L0 100 Z');
    expect(geometry.goalLineY).toBe(55);
    expect(geometry.lastX).toBe(320);
    expect(geometry.lastY).toBe(25);
  });

  it('fordeler punkterne jævnt', () => {
    const geometry = computeWeightChartGeometry([70, 71, 72], 70);

    expect(geometry.linePath).toBe('M0 85 L160 55 L320 25');
  });

  it('tager målvægten med i skalaen, også når den ligger uden for kurven', () => {
    const geometry = computeWeightChartGeometry([80, 80], 60);

    expect(geometry.goalLineY).toBeGreaterThan(geometry.lastY);
    expect(geometry.goalLineY).toBeLessThanOrEqual(100);
  });

  it('giver en tom geometri, når der er under to punkter', () => {
    expect(computeWeightChartGeometry([], 70).linePath).toBe('');
    expect(computeWeightChartGeometry([70], 70).linePath).toBe('');
    expect(computeWeightChartGeometry([70], 70).areaPath).toBe('');
  });
});
