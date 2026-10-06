import { clamp, parseDecimal, shareOf } from './math';

describe('clamp', () => {
  it('keeps values inside the interval', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('cuts values outside the interval', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(-1.5, -1, 1)).toBe(-1);
  });
});

describe('shareOf', () => {
  it('is the value as a share of the goal, at most 1', () => {
    expect(shareOf(50, 200)).toBe(0.25);
    expect(shareOf(300, 200)).toBe(1);
  });

  it('is 0 without a goal', () => {
    expect(shareOf(50, 0)).toBe(0);
  });
});

describe('parseDecimal', () => {
  it('reads a decimal comma or point', () => {
    expect(parseDecimal('45,5')).toBe(45.5);
    expect(parseDecimal('45.5')).toBe(45.5);
    expect(parseDecimal(' 150 ')).toBe(150);
  });

  it('gives null for an empty field or text that is not a number', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
});
