import { HOURS_PER_DAY, MINUTES_PER_HOUR } from '../constants/time';
import { ClockTime } from '../models/reminder';

const CLOCK_TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

/** `{ hour: 7, minute: 5 }` → `'07:05'` – the value format of `<input type="time">`. */
export function formatClockTime(time: ClockTime): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

/** `'07:05'` → `{ hour: 7, minute: 5 }`. `null` for an empty or invalid value. */
export function parseClockTime(value: string): ClockTime | null {
  const match = CLOCK_TIME_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const time = { hour: Number(match[1]), minute: Number(match[2]) };
  return isClockTime(time) ? time : null;
}

export function isClockTime(value: unknown): value is ClockTime {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { hour, minute } = value as Partial<Record<keyof ClockTime, unknown>>;
  return (
    typeof hour === 'number' &&
    typeof minute === 'number' &&
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour < HOURS_PER_DAY &&
    minute >= 0 &&
    minute < MINUTES_PER_HOUR
  );
}
