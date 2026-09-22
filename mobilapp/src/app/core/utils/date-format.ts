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
const DECIMAL_SEPARATOR = ',';
const THOUSANDS_SEPARATOR = '.';
/** `74,0` vises som `74` – designets `weightText` fjerner en tom decimal. */
const EMPTY_DECIMAL = ',0';
const WEIGHT_DECIMAL_FACTOR = 10;

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

/** `'16. maj 1998'`. */
export function formatLongDate(date: Date): string {
  return `${date.getDate()}. ${MONTH_NAMES_LONG[date.getMonth()] ?? ''} ${date.getFullYear()}`;
}

/** `'07:45'` – 24-timers klokkeslæt. */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Dansk decimaltal med komma: `formatDecimal(74.5, 1)` → `'74,5'`. */
export function formatDecimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', DECIMAL_SEPARATOR);
}

/**
 * Vægt som designets `weightText`: rundet til én decimal med dansk komma og uden decimalen,
 * når den er nul (`75` / `74,5`). Bruges af opret-flowet, Vægt, Hjem og Profil.
 */
export function formatWeightKg(kg: number): string {
  const rounded = Math.round(kg * WEIGHT_DECIMAL_FACTOR) / WEIGHT_DECIMAL_FACTOR;
  return formatDecimal(rounded, 1).replace(EMPTY_DECIMAL, '');
}

/** Dansk heltal med tusindtalspunktum: `formatInteger(6000)` → `'6.000'`. */
export function formatInteger(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
  return value < 0 ? `-${grouped}` : grouped;
}

/** Fortegnet delta: `'+0,6'`, `'−1,2'` (typografisk minus) eller `'0,0'`. */
export function formatSignedDecimal(value: number, digits = 1): string {
  const magnitude = formatDecimal(Math.abs(value), digits);
  if (value > 0) {
    return `+${magnitude}`;
  }
  if (value < 0) {
    return `−${magnitude}`;
  }
  return magnitude;
}
