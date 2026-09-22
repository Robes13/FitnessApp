import { MAX_CANDLES, cakeTierCount, computeCakeGeometry } from './cake-geometry';

describe('cakeTierCount', () => {
  it('grows with age, as in the design', () => {
    expect(cakeTierCount(19)).toBe(1);
    expect(cakeTierCount(20)).toBe(2);
    expect(cakeTierCount(49)).toBe(2);
    expect(cakeTierCount(50)).toBe(3);
  });
});

describe('computeCakeGeometry', () => {
  it('draws a single tier with scalloped icing when no age is known', () => {
    const cake = computeCakeGeometry(0);

    expect(cake.tiers).toBe(1);
    expect(cake.top).toBe(254);
    expect(cake.surfaceRx).toBe(58);
    expect(cake.surfaceRxInner).toBe(51);
    expect(cake.numberY).toBe(294);
    expect(cake.candles).toEqual([]);

    const tier = cake.layers[0];
    expect(tier?.x).toBe(146);
    expect(tier?.y).toBe(254);
    expect(tier?.width).toBe(116);
    expect(tier?.drip.startsWith('M146.0 254 h 116 v 8 q -7.3 9 -14.5 0')).toBe(true);
    // 116 / 14 rounds to 8 arcs.
    expect(tier?.drip.split('q')).toHaveLength(9);
  });

  it('stacks two tiers and one candle per year', () => {
    const cake = computeCakeGeometry(28);

    expect(cake.tiers).toBe(2);
    expect(cake.top).toBe(226);
    expect(cake.layers[1]?.width).toBe(100);
    expect(cake.candles).toHaveLength(MAX_CANDLES);
    expect(cake.candles.every((candle) => candle.height >= 13)).toBe(true);
  });

  it('caps the candles at 25 and spreads them over three rings', () => {
    const cake = computeCakeGeometry(60);

    expect(cake.tiers).toBe(3);
    expect(cake.candles).toHaveLength(MAX_CANDLES);
    // The rings have heights 15, 14 and 13 (15 − ring number).
    expect(new Set(cake.candles.map((candle) => candle.height))).toEqual(new Set([15, 14, 13]));
  });

  it('never leaves a single candle alone in the inner ring', () => {
    const cake = computeCakeGeometry(13);

    expect(cake.candles).toHaveLength(13);
    expect(cake.candles.filter((candle) => candle.height === 14)).toHaveLength(2);
    expect(cake.candles.filter((candle) => candle.height === 15)).toHaveLength(11);
  });

  it('sorts the candles back to front, so the nearest ones are drawn last', () => {
    const feet = computeCakeGeometry(20).candles.map((candle) => candle.y + candle.height);

    expect(feet).toEqual([...feet].sort((a, b) => a - b));
  });
});
