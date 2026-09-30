import { TestBed } from '@angular/core/testing';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { REMINDER_ERROR_KEY } from '../../constants/reminders';
import { STORAGE_KEY } from '../../constants/storage-key';
import { ReminderNotifier, ReminderPermission, ScheduledReminder } from '../../models/reminder';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { injectTranslate } from '../language/translate';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { REMINDER_NOTIFIER } from './reminder-notifier';
import { ReminderService } from './reminders';
import { SessionService } from '../session/session';

/** In-memory stand-in for the platform's local notifications. */
class FakeNotifier implements ReminderNotifier {
  available = true;
  permission: ReminderPermission = 'granted';
  /** What the permission dialog answers. */
  answer: ReminderPermission = 'granted';
  failSchedule = false;
  failRequest = false;
  requests = 0;
  readonly pending = new Map<number, ScheduledReminder>();

  isAvailable(): boolean {
    return this.available;
  }

  async checkPermission(): Promise<ReminderPermission> {
    return this.permission;
  }

  async requestPermission(): Promise<ReminderPermission> {
    this.requests += 1;
    if (this.failRequest) {
      throw new Error('request failed');
    }
    this.permission = this.answer;
    return this.permission;
  }

  async schedule(reminders: readonly ScheduledReminder[]): Promise<void> {
    if (this.failSchedule) {
      throw new Error('schedule failed');
    }
    for (const reminder of reminders) {
      this.pending.set(reminder.notificationId, reminder);
    }
  }

  async cancel(notificationIds: readonly number[]): Promise<void> {
    for (const id of notificationIds) {
      this.pending.delete(id);
    }
  }

  pendingIds(): number[] {
    return [...this.pending.keys()].sort();
  }
}

function translate(key: string): string {
  return TestBed.runInInjectionContext(() => injectTranslate())(key);
}

const LOGGED_IN = { isLoggedIn: true, isEmailVerified: true };
const DAILY_LOG_ID = 1005;
const BREAKFAST_ID = 1001;
const WEIGH_IN_ID = 1004;

describe('ReminderService', () => {
  let storage: FakeStorage;
  let notifier: FakeNotifier;

  function setup(): ReminderService {
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment({ storage }),
        { provide: REMINDER_NOTIFIER, useValue: notifier },
      ],
    });
    return TestBed.inject(ReminderService);
  }

  /** Runs the effect and waits for every queued sync. */
  async function settle(service: ReminderService): Promise<void> {
    TestBed.tick();
    await service.sync();
  }

  beforeEach(() => {
    storage = createFakeStorage({ [STORAGE_KEY.SESSION]: LOGGED_IN });
    notifier = new FakeNotifier();
  });

  it('schedules the default evening reminder on start', async () => {
    const service = setup();
    await settle(service);

    expect(notifier.pendingIds()).toEqual([DAILY_LOG_ID]);
    expect(notifier.pending.get(DAILY_LOG_ID)?.time).toEqual({ hour: 21, minute: 0 });
    expect(service.isDelivering()).toBe(true);
  });

  it('reschedules idempotently with stable ids', async () => {
    const service = setup();
    await settle(service);
    await service.sync();
    await service.sync();

    expect(notifier.pendingIds()).toEqual([DAILY_LOG_ID]);
  });

  it('saves a change and reschedules with the new time', async () => {
    const service = setup();
    await settle(service);

    service.update('morgen', { enabled: true, time: { hour: 7, minute: 15 } });
    await settle(service);

    expect(notifier.pendingIds()).toEqual([BREAKFAST_ID, DAILY_LOG_ID]);
    expect(notifier.pending.get(BREAKFAST_ID)?.time).toEqual({ hour: 7, minute: 15 });
    expect(JSON.parse(storage.getItem(STORAGE_KEY.REMINDERS) ?? '{}').morgen).toEqual({
      enabled: true,
      time: { hour: 7, minute: 15 },
      weekday: null,
    });
  });

  it('only lets the weigh-in be weekly', async () => {
    const service = setup();
    await settle(service);

    service.update('weigh-in', { enabled: true, weekday: 0 });
    service.update('frokost', { enabled: true, weekday: 3 });
    await settle(service);

    expect(notifier.pending.get(WEIGH_IN_ID)?.weekday).toBe(0);
    expect(notifier.pending.get(1002)?.weekday).toBeNull();
  });

  it('cancels everything when the master switch goes off, and restores it when it is back on', async () => {
    const service = setup();
    await settle(service);

    service.setMasterEnabled(false);
    await settle(service);
    expect(notifier.pendingIds()).toEqual([]);
    expect(service.isDelivering()).toBe(false);

    service.setMasterEnabled(true);
    await settle(service);
    expect(notifier.pendingIds()).toEqual([DAILY_LOG_ID]);
  });

  it('cancels everything on log out and schedules nothing while logged out', async () => {
    const service = setup();
    await settle(service);

    TestBed.inject(SessionService).logout();
    await settle(service);

    expect(notifier.pendingIds()).toEqual([]);
  });

  it('asks for permission when a reminder is turned on and schedules once granted', async () => {
    notifier.permission = 'prompt';
    const service = setup();
    await settle(service);
    expect(notifier.pendingIds()).toEqual([]);
    expect(notifier.requests).toBe(0);

    service.update('aften', { enabled: true });
    await settle(service);

    expect(notifier.requests).toBe(1);
    expect(service.permission()).toBe('granted');
    expect(notifier.pendingIds()).toEqual([1003, DAILY_LOG_ID]);
  });

  it('keeps the settings but schedules nothing when permission is denied', async () => {
    notifier.permission = 'prompt';
    notifier.answer = 'denied';
    const service = setup();
    await settle(service);

    service.update('aften', { enabled: true });
    await settle(service);

    expect(service.permission()).toBe('denied');
    expect(service.settings().aften.enabled).toBe(true);
    expect(notifier.pendingIds()).toEqual([]);

    // Once denied, the platform answers by itself – the app doesn't keep asking.
    service.update('frokost', { enabled: true });
    await settle(service);
    expect(notifier.requests).toBe(1);
  });

  it('picks up a permission granted in the phone settings when the app returns', async () => {
    notifier.permission = 'denied';
    const service = setup();
    await settle(service);
    expect(notifier.pendingIds()).toEqual([]);

    notifier.permission = 'granted';
    await service.sync();

    expect(notifier.pendingIds()).toEqual([DAILY_LOG_ID]);
  });

  it('saves settings without touching the plugin in the browser', async () => {
    notifier.available = false;
    const service = setup();
    await settle(service);

    service.update('morgen', { enabled: true });
    await settle(service);

    expect(service.permission()).toBe('unsupported');
    expect(service.isSupported()).toBe(false);
    expect(notifier.requests).toBe(0);
    expect(notifier.pendingIds()).toEqual([]);
    expect(service.settings().morgen.enabled).toBe(true);
  });

  it('reports a failed schedule with a Danish message and logs it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    notifier.failSchedule = true;
    const service = setup();
    await settle(service);

    expect(service.error()).toBe(translate(REMINDER_ERROR_KEY.SCHEDULE));
    expect(consoleError).toHaveBeenCalled();

    notifier.failSchedule = false;
    await service.sync();
    expect(service.error()).toBeNull();
    consoleError.mockRestore();
  });

  it('keeps a failed permission request visible until the permission changes', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    notifier.permission = 'prompt';
    notifier.failRequest = true;
    const service = setup();
    await settle(service);

    service.update('morgen', { enabled: true });
    await settle(service);
    await service.sync();

    expect(service.error()).toBe(translate(REMINDER_ERROR_KEY.PERMISSION));

    notifier.permission = 'granted';
    await service.sync();
    expect(service.error()).toBeNull();
    consoleError.mockRestore();
  });

  it('falls back to defaults for missing or invalid stored fields', () => {
    storage.setItem(
      STORAGE_KEY.REMINDERS,
      JSON.stringify({
        morgen: { enabled: true, time: { hour: 30, minute: 0 }, weekday: 9 },
        'weigh-in': { enabled: 'yes', time: { hour: 6, minute: 45 }, weekday: 2 },
      }),
    );
    const service = setup();

    expect(service.settings().morgen).toEqual({
      enabled: true,
      time: { hour: 8, minute: 0 },
      weekday: null,
    });
    expect(service.settings()['weigh-in']).toEqual({
      enabled: false,
      time: { hour: 6, minute: 45 },
      weekday: 2,
    });
    expect(service.settings()['daily-log'].enabled).toBe(true);
  });

  it('counts the enabled reminders', () => {
    storage.setItem(STORAGE_KEY.PROFILE, JSON.stringify(DEFAULT_PROFILE));
    const service = setup();

    expect(service.enabledCount()).toBe(1);
    service.update('morgen', { enabled: true });
    expect(service.enabledCount()).toBe(2);
  });
});
