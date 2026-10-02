import { clamp, parseDecimal } from './math';

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
