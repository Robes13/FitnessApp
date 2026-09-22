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
/** Al tal- og datoformatering i appen er dansk (`LOCALE_ID` er `'da'`). */
const LOCALE = 'da-DK';
/** Designet skriver negative tal med typografisk minus, ikke bindestreg. */
const TYPOGRAPHIC_MINUS = '−';

/** 0 = mandag … 6 = søndag (JavaScript starter ugen søndag). */
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

/** Hele kalenderdage fra `from` til `to` (positivt når `to` ligger senere). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** Lokal dato som `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `'I dag'` / `'I går'` / `'3 dage siden'`. Fremtidige datoer behandles som i dag. */
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

/** `'Tir.'` – ugedagen forkortet med punktum som i historikken. */
export function formatWeekdayAbbreviated(date: Date): string {
  return `${DAY_NAMES_SHORT[mondayIndex(date)] ?? ''}.`;
}

/** `'07:45'` – 24-timers klokkeslæt. */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Dansk decimaltal med komma: `formatDecimal(74.5, 1)` → `'74,5'`. */
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Vægt som designets `weightText`: højst én decimal med dansk komma, og uden decimalen,
 * når den er nul (`75` / `74,5`). Bruges af opret-flowet, Vægt, Hjem og Profil.
 */
export function formatWeightKg(kg: number): string {
  return kg.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
}

/** Dansk heltal med tusindtalspunktum: `formatInteger(6000)` → `'6.000'`. */
export function formatInteger(value: number): string {
  return value.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

/** Fortegnet delta: `'+0,6'`, `'−1,2'` (typografisk minus) eller `'0,0'`. */
export function formatSignedDecimal(value: number, digits = 1): string {
  return value
    .toLocaleString(LOCALE, {
      signDisplay: 'exceptZero',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    .replace('-', TYPOGRAPHIC_MINUS);
}
