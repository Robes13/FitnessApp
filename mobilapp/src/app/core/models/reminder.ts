import { MealId } from './meal';

/** The meals that can have a reminder. Snacks have no fixed time, so they get none. */
export type MealReminderId = Exclude<MealId, 'snack'>;

/** Every kind of reminder: one per main meal, the weigh-in and the evening "log today's food". */
export type ReminderId = MealReminderId | 'weigh-in' | 'daily-log';

/** Day of the week, `0` = Monday … `6` = Sunday – the same convention as `mondayIndex()`. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A time of day on the 24-hour clock. `hour` 0..23, `minute` 0..59. */
export interface ClockTime {
  readonly hour: number;
  readonly minute: number;
}

/** The user's choice for one reminder. `weekday` is `null` for "every day". */
export interface ReminderSetting {
  readonly enabled: boolean;
  readonly time: ClockTime;
  readonly weekday: WeekdayIndex | null;
}

export type ReminderSettings = Readonly<Record<ReminderId, ReminderSetting>>;

/**
 * A reminder kind: its label in the sheet, its notification text (as translation keys) and its
 * defaults.
 */
export interface ReminderDefinition {
  readonly id: ReminderId;
  readonly labelKey: string;
  /** Stable id of the local notification, so rescheduling replaces instead of duplicating. */
  readonly notificationId: number;
  readonly titleKey: string;
  readonly bodyKey: string;
  /** Only the weigh-in can be limited to one day a week. */
  readonly allowsWeekday: boolean;
  readonly defaults: ReminderSetting;
}

/**
 * Whether the app may show notifications. `unknown` until the platform has been asked;
 * `unsupported` in the browser, where local notifications aren't available.
 */
export type ReminderPermission = 'unknown' | 'granted' | 'denied' | 'prompt' | 'unsupported';

/** One repeating notification as handed to the platform. `weekday` `null` = daily. */
export interface ScheduledReminder {
  readonly notificationId: number;
  readonly title: string;
  readonly body: string;
  readonly time: ClockTime;
  readonly weekday: WeekdayIndex | null;
}

/**
 * The platform's local notifications, behind an interface so `ReminderService` can be
 * tested without Capacitor. See `REMINDER_NOTIFIER`.
 */
export interface ReminderNotifier {
  /** `false` in the browser or when the native plugin is missing. */
  isAvailable(): boolean;
  checkPermission(): Promise<ReminderPermission>;
  requestPermission(): Promise<ReminderPermission>;
  schedule(reminders: readonly ScheduledReminder[]): Promise<void>;
  cancel(notificationIds: readonly number[]): Promise<void>;
}
