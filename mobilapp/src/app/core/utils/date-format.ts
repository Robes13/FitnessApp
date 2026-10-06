import { signal } from '@angular/core';
import { DEFAULT_LANGUAGE, INTL_LOCALE } from '../constants/language';
import { DAYS_PER_WEEK, MS_PER_DAY } from '../constants/time';
import { Language } from '../models/language';
import { Translate } from '../services/language/translate';

/** Translation keys of the weekdays, Monday first: `'Man'`. */
export const DAY_NAME_SHORT_KEYS = [
  'core.date.dayShort.mon',
  'core.date.dayShort.tue',
  'core.date.dayShort.wed',
  'core.date.dayShort.thu',
  'core.date.dayShort.fri',
  'core.date.dayShort.sat',
  'core.date.dayShort.sun',
] as const;
/** Translation keys of the weekdays, Monday first: `'Mandag'`. */
export const DAY_NAME_LONG_KEYS = [
  'core.date.dayLong.mon',
  'core.date.dayLong.tue',
  'core.date.dayLong.wed',
  'core.date.dayLong.thu',
  'core.date.dayLong.fri',
  'core.date.dayLong.sat',
  'core.date.dayLong.sun',
] as const;
/** Translation keys of the weekdays' letters, Monday first: `'M'`, `'Ti'`. */
export const DAY_LETTER_KEYS = [
  'core.date.dayLetter.mon',
  'core.date.dayLetter.tue',
  'core.date.dayLetter.wed',
  'core.date.dayLetter.thu',
  'core.date.dayLetter.fri',
  'core.date.dayLetter.sat',
  'core.date.dayLetter.sun',
] as const;
/** Translation keys of the months, January first: `'jan'`. */
export const MONTH_NAME_SHORT_KEYS = [
  'core.date.monthShort.jan',
  'core.date.monthShort.feb',
  'core.date.monthShort.mar',
  'core.date.monthShort.apr',
  'core.date.monthShort.may',
  'core.date.monthShort.jun',
  'core.date.monthShort.jul',
  'core.date.monthShort.aug',
  'core.date.monthShort.sep',
  'core.date.monthShort.oct',
  'core.date.monthShort.nov',
  'core.date.monthShort.dec',
] as const;

const SUNDAY_OFFSET = 6;
/**
 * Numbers are formatted in the app's language (`'74,5'` in Danish, `'74.5'` in English). A signal,
 * so a `computed()` that formats a number recomputes when `LanguageService` switches language.
 */
const numberLocale = signal(INTL_LOCALE[DEFAULT_LANGUAGE]);

export function setNumberLocale(language: Language): void {
  numberLocale.set(INTL_LOCALE[language]);
}
/** The design writes negative numbers with a typographic minus, not a hyphen. */
const TYPOGRAPHIC_MINUS = '−';

/** 0 = Monday … 6 = Sunday (JavaScript's week starts on Sunday). */
export function mondayIndex(date: Date): number {
  return (date.getDay() + SUNDAY_OFFSET) % DAYS_PER_WEEK;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toIsoDate(a) === toIsoDate(b);
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** Local date as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local midnight of a `YYYY-MM-DD` date (the inverse of `toIsoDate`). */
export function fromIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** `'I dag'` / `'I går'` / `'3 dage siden'`. Future dates are treated as today. */
export function formatRelativeDay(t: Translate, date: Date, today: Date): string {
  const days = daysBetween(date, today);
  if (days <= 0) {
    return t('core.date.today');
  }
  if (days === 1) {
    return t('core.date.yesterday');
  }
  return t('core.date.daysAgo', { days });
}

/** `'21. sep'`. */
export function formatDayMonth(t: Translate, date: Date): string {
  const month = MONTH_NAME_SHORT_KEYS[date.getMonth()];
  return t('core.date.dayMonth', { day: date.getDate(), month: month ? t(month) : '' });
}

/** `'Mandag 21. sep'`. */
export function formatDayLabel(t: Translate, date: Date): string {
  const weekday = DAY_NAME_LONG_KEYS[mondayIndex(date)];
  return t('core.date.dayLabel', {
    weekday: weekday ? t(weekday) : '',
    dayMonth: formatDayMonth(t, date),
  });
}

/** `'Tir.'` – the weekday abbreviated with a period, as in the history. */
export function formatWeekdayAbbreviated(t: Translate, date: Date): string {
  const weekday = DAY_NAME_SHORT_KEYS[mondayIndex(date)];
  return t('core.date.weekdayAbbreviated', { weekday: weekday ? t(weekday) : '' });
}

/** `'07:45'` – 24-hour time. */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Danish decimal number with a comma: `formatDecimal(74.5, 1)` → `'74,5'`. */
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString(numberLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Grams (or another summed amount) with at most one decimal and a Danish comma, so float
 * noise from summing never reaches the screen: `188.70000000000002` → `'188,7'`, `65` → `'65'`.
 */
export function formatGrams(value: number): string {
  return value.toLocaleString(numberLocale(), { maximumFractionDigits: 1 });
}

/**
 * Weight as the design's `weightText`: at most one decimal with a Danish comma, and
 * without the decimal when it's zero (`75` / `74,5`). Used by the sign-up flow, Weight,
 * Home and Profile. The same formatting as `formatGrams`, kept under its own name for them.
 */
export const formatWeightKg = formatGrams;

/** Danish integer with a thousands separator: `formatInteger(6000)` → `'6.000'`. */
export function formatInteger(value: number): string {
  return value.toLocaleString(numberLocale(), { maximumFractionDigits: 0 });
}

/** Signed delta: `'+0,6'`, `'−1,2'` (typographic minus) or `'0,0'`. */
export function formatSignedDecimal(value: number, digits = 1): string {
  return value
    .toLocaleString(numberLocale(), {
      signDisplay: 'exceptZero',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    .replace('-', TYPOGRAPHIC_MINUS);
}

const FALLBACK_TIME_ZONE_ID = 'UTC';

/** The device's IANA time zone (`'Europe/Copenhagen'`) – what the API's `timeZoneId` expects. */
export function currentTimeZoneId(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE_ID;
}
