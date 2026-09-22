import { formatClockTime, isClockTime, parseClockTime } from './clock-time';

describe('clock-time', () => {
  it('formats with two digits', () => {
    expect(formatClockTime({ hour: 7, minute: 5 })).toBe('07:05');
    expect(formatClockTime({ hour: 21, minute: 30 })).toBe('21:30');
  });

  it('parses the value of a time input', () => {
    expect(parseClockTime('07:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseClockTime(' 9:00 ')).toEqual({ hour: 9, minute: 0 });
  });

  it('rejects empty and out-of-range values', () => {
    expect(parseClockTime('')).toBeNull();
    expect(parseClockTime('24:00')).toBeNull();
    expect(parseClockTime('12:60')).toBeNull();
    expect(parseClockTime('kl. 8')).toBeNull();
  });

  it('recognizes valid stored times only', () => {
    expect(isClockTime({ hour: 0, minute: 0 })).toBe(true);
    expect(isClockTime({ hour: 1.5, minute: 0 })).toBe(false);
    expect(isClockTime({ hour: '8', minute: 0 })).toBe(false);
    expect(isClockTime(null)).toBe(false);
  });
});
