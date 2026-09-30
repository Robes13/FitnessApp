import { TestBed } from '@angular/core/testing';
import { Translate, injectTranslate } from '../services/language/translate';
import {
  DAY_LETTER_KEYS,
  DAY_NAME_LONG_KEYS,
  DAY_NAME_SHORT_KEYS,
  MONTH_NAME_LONG_KEYS,
  MONTH_NAME_SHORT_KEYS,
  addDays,
  daysBetween,
  formatDayLabel,
  formatDayMonth,
  formatDecimal,
  formatGrams,
  formatInteger,
  formatRelativeDay,
  formatSignedDecimal,
  formatTime,
  formatWeekdayAbbreviated,
  isSameDay,
  mondayIndex,
  startOfDay,
  toIsoDate,
} from './date-format';

const MONDAY = new Date(2026, 8, 21, 10, 30);

describe('date-format', () => {
  let t: Translate;

  beforeEach(() => {
    t = TestBed.runInInjectionContext(() => injectTranslate());
  });

  it('exposes Danish day and month names', () => {
    expect(DAY_NAME_SHORT_KEYS).toHaveLength(7);
    expect(t(DAY_NAME_LONG_KEYS[0])).toBe('Mandag');
    expect(DAY_LETTER_KEYS.map((key) => t(key))).toEqual(['M', 'Ti', 'O', 'To', 'F', 'L', 'S']);
    expect(t(MONTH_NAME_LONG_KEYS[8])).toBe('september');
    expect(t(MONTH_NAME_SHORT_KEYS[8])).toBe('sep');
  });

  it('indexes weeks from Monday', () => {
    expect(mondayIndex(MONDAY)).toBe(0);
    expect(mondayIndex(addDays(MONDAY, 6))).toBe(6);
    expect(mondayIndex(new Date(2026, 8, 20))).toBe(6);
  });

  it('formats ISO dates in local time', () => {
    expect(toIsoDate(MONDAY)).toBe('2026-09-21');
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('compares calendar days', () => {
    expect(isSameDay(MONDAY, new Date(2026, 8, 21, 23, 59))).toBe(true);
    expect(isSameDay(MONDAY, addDays(MONDAY, 1))).toBe(false);
    expect(daysBetween(addDays(MONDAY, -3), MONDAY)).toBe(3);
    expect(daysBetween(MONDAY, addDays(MONDAY, -3))).toBe(-3);
    expect(startOfDay(MONDAY).getHours()).toBe(0);
  });

  it('formats relative days like the design', () => {
    expect(formatRelativeDay(t, MONDAY, MONDAY)).toBe('I dag');
    expect(formatRelativeDay(t, new Date(2026, 8, 21, 0, 1), MONDAY)).toBe('I dag');
    expect(formatRelativeDay(t, addDays(MONDAY, -1), MONDAY)).toBe('I går');
    expect(formatRelativeDay(t, addDays(MONDAY, -3), MONDAY)).toBe('3 dage siden');
    expect(formatRelativeDay(t, addDays(MONDAY, 2), MONDAY)).toBe('I dag');
  });

  it('formats day labels', () => {
    expect(formatDayLabel(t, MONDAY)).toBe('Mandag 21. sep');
    expect(formatDayMonth(t, MONDAY)).toBe('21. sep');
    expect(formatWeekdayAbbreviated(t, addDays(MONDAY, 1))).toBe('Tir.');
    expect(formatTime(new Date(2026, 8, 21, 7, 5))).toBe('07:05');
  });

  it('formats numbers the Danish way', () => {
    expect(formatDecimal(74.5)).toBe('74,5');
    expect(formatDecimal(23.678, 2)).toBe('23,68');
    expect(formatInteger(6000)).toBe('6.000');
    expect(formatInteger(999)).toBe('999');
    expect(formatInteger(1234567)).toBe('1.234.567');
    expect(formatInteger(-2500)).toBe('-2.500');
    expect(formatSignedDecimal(0.6)).toBe('+0,6');
    expect(formatSignedDecimal(-1.25, 2)).toBe('−1,25');
    expect(formatSignedDecimal(0)).toBe('0,0');
    expect(formatGrams(110.7 + 78.00000000000002)).toBe('188,7');
    expect(formatGrams(65)).toBe('65');
  });
});
