import { InjectionToken } from '@angular/core';
import { Capacitor, PermissionState } from '@capacitor/core';
import {
  LocalNotificationSchema,
  LocalNotifications,
  ScheduleOn,
  Weekday,
} from '@capacitor/local-notifications';
import {
  ReminderNotifier,
  ReminderPermission,
  ScheduledReminder,
  WeekdayIndex,
} from '../../models/reminder';

/** The plugin's name in the native bridge (`Capacitor.isPluginAvailable`). */
const PLUGIN_NAME = 'LocalNotifications';

/** `WeekdayIndex` (Monday first) → the plugin's `Weekday` (Sunday = 1). */
const PLUGIN_WEEKDAY: Readonly<Record<WeekdayIndex, Weekday>> = {
  0: Weekday.Monday,
  1: Weekday.Tuesday,
  2: Weekday.Wednesday,
  3: Weekday.Thursday,
  4: Weekday.Friday,
  5: Weekday.Saturday,
  6: Weekday.Sunday,
};

/**
 * A repeating notification for the plugin: `on` with hour, minute and second repeats every
 * day, adding `weekday` makes it weekly. `second: 0` fires at the top of the minute.
 *
 * `isExactNotification: false` is required: the plugin (8.3+) defaults it to `true`, and then
 * every `schedule()` on Android 12+ without the exact-alarm permission opens the system
 * "Alarms & reminders" settings. The app re-syncs on every resume, so that would nag the
 * user in a loop. A reminder a few minutes late is fine, so an inexact alarm is enough.
 */
export function toPluginNotification(reminder: ScheduledReminder): LocalNotificationSchema {
  const on: ScheduleOn = {
    hour: reminder.time.hour,
    minute: reminder.time.minute,
    second: 0,
    ...(reminder.weekday === null ? {} : { weekday: PLUGIN_WEEKDAY[reminder.weekday] }),
  };
  return {
    id: reminder.notificationId,
    title: reminder.title,
    body: reminder.body,
    schedule: { on, allowWhileIdle: true },
    isExactNotification: false,
  };
}

export function toReminderPermission(state: PermissionState): ReminderPermission {
  switch (state) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
    case 'prompt-with-rationale':
      return 'prompt';
  }
}

/** `@capacitor/local-notifications` on iOS and Android. Unavailable in the browser. */
export class CapacitorReminderNotifier implements ReminderNotifier {
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(PLUGIN_NAME);
  }

  async checkPermission(): Promise<ReminderPermission> {
    const status = await LocalNotifications.checkPermissions();
    return toReminderPermission(status.display);
  }

  async requestPermission(): Promise<ReminderPermission> {
    const status = await LocalNotifications.requestPermissions();
    return toReminderPermission(status.display);
  }

  async schedule(reminders: readonly ScheduledReminder[]): Promise<void> {
    if (reminders.length === 0) {
      return;
    }
    await LocalNotifications.schedule({ notifications: reminders.map(toPluginNotification) });
  }

  async cancel(notificationIds: readonly number[]): Promise<void> {
    if (notificationIds.length === 0) {
      return;
    }
    await LocalNotifications.cancel({ notifications: notificationIds.map((id) => ({ id })) });
  }
}

/** The platform's local notifications. Specs provide a fake. */
export const REMINDER_NOTIFIER = new InjectionToken<ReminderNotifier>('REMINDER_NOTIFIER', {
  providedIn: 'root',
  factory: () => new CapacitorReminderNotifier(),
});
