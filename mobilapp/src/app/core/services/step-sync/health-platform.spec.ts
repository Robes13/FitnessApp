import { totalsByLocalDay } from './health-platform';

/** A bucket between two local times, as the plugin answers it (ISO instants). */
function bucket(start: Date, end: Date, value: number) {
  return { startDate: start.toISOString(), endDate: end.toISOString(), value };
}

describe('totalsByLocalDay', () => {
  it('keeps calendar-day buckets as they are (HealthKit)', () => {
    expect(
      totalsByLocalDay([
        bucket(new Date(2026, 8, 29), new Date(2026, 8, 30), 8000),
        bucket(new Date(2026, 8, 30), new Date(2026, 9, 1), 6000),
      ]),
    ).toEqual([8000, 6000]);
  });

  it("adds Health Connect's one-hour slice after the autumn switch to the last day", () => {
    // After the switch the 24-hour slices run 23–23, and the window's last hour is a slice alone.
    expect(
      totalsByLocalDay([
        bucket(new Date(2026, 9, 29, 23), new Date(2026, 9, 30, 23), 7000),
        bucket(new Date(2026, 9, 30, 23), new Date(2026, 9, 31, 23), 9000),
        bucket(new Date(2026, 9, 31, 23), new Date(2026, 10, 1), 500),
      ]),
    ).toEqual([7000, 9500]);
  });

  it('keeps the days apart when the slices run 01–01 after the spring switch', () => {
    expect(
      totalsByLocalDay([
        bucket(new Date(2026, 3, 1, 1), new Date(2026, 3, 2, 1), 7000),
        bucket(new Date(2026, 3, 2, 1), new Date(2026, 3, 3), 9000),
      ]),
    ).toEqual([7000, 9000]);
  });
});
