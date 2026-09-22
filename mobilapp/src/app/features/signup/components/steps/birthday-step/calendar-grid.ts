import { mondayIndex, toIsoDate } from '../../../../../core/utils/date-format';

/** Én celle i månedsgitteret. `ghost` er en dag fra nabomåneden. */
export interface CalendarCell {
  readonly iso: string;
  readonly label: string;
  readonly year: number;
  readonly month: number;
  readonly ghost: boolean;
  readonly selected: boolean;
  /** Fremtidige datoer kan ikke vælges (man kan ikke være født i morgen). */
  readonly future: boolean;
}

/** Designets gitter er altid 6 uger højt, så layoutet ikke hopper mellem måneder. */
export const CALENDAR_CELL_COUNT = 42;
export const CALENDAR_WEEKDAYS = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'] as const;
export const CALENDAR_MIN_YEAR = 1900;
/** Designets startvisning, når ingen dato er valgt endnu: juni 1998. */
export const CALENDAR_DEFAULT_YEAR = 1998;
export const CALENDAR_DEFAULT_MONTH = 5;

const MONTHS_PER_YEAR = 12;

function cell(date: Date, selectedIso: string, today: Date, ghost: boolean): CalendarCell {
  const iso = toIsoDate(date);
  return {
    iso,
    label: String(date.getDate()),
    year: date.getFullYear(),
    month: date.getMonth(),
    ghost,
    selected: !ghost && iso === selectedIso,
    future: date > today,
  };
}

/**
 * Bygger de 42 celler for `year`/`month`: først de manglende dage fra forrige måned,
 * så månedens egne dage, og til sidst nok dage fra næste måned til at fylde gitteret.
 * Ugen starter mandag. Port af designets `calendar()`.
 */
export function buildCalendarCells(
  year: number,
  month: number,
  selectedIso: string,
  today: Date,
): readonly CalendarCell[] {
  const lead = mondayIndex(new Date(year, month, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let offset = lead; offset > 0; offset--) {
    cells.push(cell(new Date(year, month, 1 - offset), selectedIso, today, true));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(cell(new Date(year, month, day), selectedIso, today, false));
  }
  for (let day = 1; cells.length < CALENDAR_CELL_COUNT; day++) {
    cells.push(cell(new Date(year, month + 1, day), selectedIso, today, true));
  }
  return cells;
}

/** År og måned efter et spring, klemt fast så visningen aldrig lander i fremtiden. */
export function shiftCalendar(
  year: number,
  month: number,
  deltaYears: number,
  deltaMonths: number,
  today: Date,
): { readonly year: number; readonly month: number } {
  let nextYear = year + deltaYears;
  let nextMonth = month + deltaMonths;
  if (nextMonth < 0) {
    nextMonth = MONTHS_PER_YEAR - 1;
    nextYear--;
  }
  if (nextMonth > MONTHS_PER_YEAR - 1) {
    nextMonth = 0;
    nextYear++;
  }
  if (new Date(nextYear, nextMonth, 1) > today) {
    nextYear = today.getFullYear();
    nextMonth = today.getMonth();
  }
  return { year: Math.max(CALENDAR_MIN_YEAR, nextYear), month: nextMonth };
}
