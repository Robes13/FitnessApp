export const DAY_NAMES_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'] as const;
export const DAY_NAMES_LONG = [
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
  'Søndag',
] as const;
export const DAY_LETTERS = ['M', 'Ti', 'O', 'To', 'F', 'L', 'S'] as const;
export const MONTH_NAMES_LONG = [
  'januar',
  'februar',
  'marts',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'december',
] as const;
export const MONTH_NAMES_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
] as const;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const SUNDAY_OFFSET = 6;
/** All number and date formatting in the app is Danish (`LOCALE_ID` is `'da'`). */
const LOCALE = 'da-DK';
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

/** `'I dag'` / `'I går'` / `'3 dage siden'`. Future dates are treated as today. */
export function formatRelativeDay(date: Date, today: Date): string {
  const days = daysBetween(date, today);
  if (days <= 0) {
    return 'I dag';
  }
  if (days === 1) {
    return 'I går';
  }
  return `${days} dage siden`;
}

/** `'21. sep'`. */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()}. ${MONTH_NAMES_SHORT[date.getMonth()] ?? ''}`;
}

/** `'Mandag 21. sep'`. */
export function formatDayLabel(date: Date): string {
  return `${DAY_NAMES_LONG[mondayIndex(date)] ?? ''} ${formatDayMonth(date)}`;
}

/** `'Tir.'` – the weekday abbreviated with a period, as in the history. */
export function formatWeekdayAbbreviated(date: Date): string {
  return `${DAY_NAMES_SHORT[mondayIndex(date)] ?? ''}.`;
}

/** `'07:45'` – 24-hour time. */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Danish decimal number with a comma: `formatDecimal(74.5, 1)` → `'74,5'`. */
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Weight as the design's `weightText`: at most one decimal with a Danish comma, and
 * without the decimal when it's zero (`75` / `74,5`). Used by the sign-up flow, Weight,
 * Home and Profile.
 */
export function formatWeightKg(kg: number): string {
  return kg.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
}

/** Danish integer with a thousands separator: `formatInteger(6000)` → `'6.000'`. */
export function formatInteger(value: number): string {
  return value.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

/** Signed delta: `'+0,6'`, `'−1,2'` (typographic minus) or `'0,0'`. */
export function formatSignedDecimal(value: number, digits = 1): string {
  return value
    .toLocaleString(LOCALE, {
      signDisplay: 'exceptZero',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    .replace('-', TYPOGRAPHIC_MINUS);
}
