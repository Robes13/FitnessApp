import { TEST_NOW } from '../../../../../core/testing/test-providers';
import { CALENDAR_CELL_COUNT, buildCalendarCells, shiftCalendar } from './calendar-grid';

/** Monday, September 21, 2026 – the same "now" as the rest of the tests. */
const TODAY = new Date(TEST_NOW.getFullYear(), TEST_NOW.getMonth(), TEST_NOW.getDate());

describe('buildCalendarCells', () => {
  it('fills six weeks starting on Monday', () => {
    const cells = buildCalendarCells(1998, 4, '', TODAY);

    expect(cells).toHaveLength(CALENDAR_CELL_COUNT);
    // May 1, 1998 was a Friday, so Monday–Thursday come from April.
    expect(cells[0]?.iso).toBe('1998-04-27');
    expect(cells[0]?.ghost).toBe(true);
    expect(cells[4]?.iso).toBe('1998-05-01');
    expect(cells[4]?.ghost).toBe(false);
    expect(cells[CALENDAR_CELL_COUNT - 1]?.ghost).toBe(true);
  });

  it('marks the selected day and never the ghost copy of it', () => {
    const cells = buildCalendarCells(1998, 4, '1998-05-16', TODAY);

    expect(cells.filter((cell) => cell.selected)).toHaveLength(1);
    expect(cells.find((cell) => cell.selected)?.iso).toBe('1998-05-16');
  });

  it('marks days after today as future', () => {
    const cells = buildCalendarCells(2026, 8, '', TODAY);

    expect(cells.find((cell) => cell.iso === '2026-09-21')?.future).toBe(false);
    expect(cells.find((cell) => cell.iso === '2026-09-22')?.future).toBe(true);
  });
});

describe('shiftCalendar', () => {
  it('wraps between years', () => {
    expect(shiftCalendar(1998, 0, 0, -1, TODAY)).toEqual({ year: 1997, month: 11 });
    expect(shiftCalendar(1998, 11, 0, 1, TODAY)).toEqual({ year: 1999, month: 0 });
  });

  it('never moves past the current month', () => {
    expect(shiftCalendar(2026, 8, 0, 1, TODAY)).toEqual({ year: 2026, month: 8 });
    expect(shiftCalendar(2026, 8, 1, 0, TODAY)).toEqual({ year: 2026, month: 8 });
  });

  it('stops at the first supported year', () => {
    expect(shiftCalendar(1900, 3, -1, 0, TODAY)).toEqual({ year: 1900, month: 3 });
  });
});
