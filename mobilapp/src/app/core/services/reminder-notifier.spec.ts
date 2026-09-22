import { Weekday } from '@capacitor/local-notifications';
import {
  CapacitorReminderNotifier,
  toPluginNotification,
  toReminderPermission,
} from './reminder-notifier';

describe('reminder-notifier', () => {
  it('schedules a daily reminder on hour and minute', () => {
    expect(
      toPluginNotification({
        notificationId: 1001,
        title: 'Tid til morgenmad',
        body: 'Husk at logge din morgenmad.',
        time: { hour: 8, minute: 15 },
        weekday: null,
      }),
    ).toEqual({
      id: 1001,
      title: 'Tid til morgenmad',
      body: 'Husk at logge din morgenmad.',
      schedule: { on: { hour: 8, minute: 15, second: 0 }, allowWhileIdle: true },
      isExactNotification: false,
    });
  });

  it('maps a Monday-first weekday to the plugin (Sunday = 1)', () => {
    const monday = toPluginNotification({
      notificationId: 1004,
      title: '',
      body: '',
      time: { hour: 7, minute: 30 },
      weekday: 0,
    });
    const sunday = toPluginNotification({
      notificationId: 1004,
      title: '',
      body: '',
      time: { hour: 7, minute: 30 },
      weekday: 6,
    });

    expect(monday.schedule?.on?.weekday).toBe(Weekday.Monday);
    expect(sunday.schedule?.on?.weekday).toBe(Weekday.Sunday);
  });

  it('never asks for exact alarms, so schedule() does not open the Android settings', () => {
    const weekly = toPluginNotification({
      notificationId: 1004,
      title: '',
      body: '',
      time: { hour: 7, minute: 30 },
      weekday: 2,
    });

    expect(weekly.isExactNotification).toBe(false);
    expect(weekly.schedule?.on).toEqual({
      hour: 7,
      minute: 30,
      second: 0,
      weekday: Weekday.Wednesday,
    });
  });

  it('treats both prompt states as "prompt"', () => {
    expect(toReminderPermission('prompt')).toBe('prompt');
    expect(toReminderPermission('prompt-with-rationale')).toBe('prompt');
    expect(toReminderPermission('granted')).toBe('granted');
    expect(toReminderPermission('denied')).toBe('denied');
  });

  it('is unavailable in the browser', () => {
    expect(new CapacitorReminderNotifier().isAvailable()).toBe(false);
  });
});
