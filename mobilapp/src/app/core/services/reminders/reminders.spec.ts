import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_REMINDER_SETTINGS, REMINDER_ERROR_KEY } from '../../constants/reminders';
import { STORAGE_KEY } from '../../constants/storage-key';
import { AuthResponse } from '../../models/auth';
import { ReminderNotifier, ReminderPermission, ScheduledReminder } from '../../models/reminder';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { AUTHENTICATED_SESSION, TEST_AUTH_RESPONSE } from '../../testing/fixtures';
import { injectTranslate } from '../language/translate';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { REMINDER_NOTIFIER } from './reminder-notifier';
import { ReminderService } from './reminders';
import { SessionService } from '../session/session';
import { UserProfileService } from '../user-profile/user-profile';

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

const NOTIFICATIONS_SETTING = '/api/v1/me/settings/Notifications';
const LOGIN = '/api/v1/auth/login';
const MORNING_ON = {
  ...DEFAULT_REMINDER_SETTINGS,
  morgen: { ...DEFAULT_REMINDER_SETTINGS.morgen, enabled: true },
};
const OTHER_ACCOUNT: AuthResponse = {
  ...TEST_AUTH_RESPONSE,
  user: { ...TEST_AUTH_RESPONSE.user, userId: 2, email: 'sara@nutrify.dk', username: 'sara' },
};

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

  function http(): HttpTestingController {
    return TestBed.inject(HttpTestingController);
  }

  /** Flips the master switch the way the API answers it. */
  async function setMaster(service: ReminderService, enabled: boolean): Promise<void> {
    const done = firstValueFrom(service.setMasterEnabled(enabled));
    http()
      .expectOne(NOTIFICATIONS_SETTING)
      .flush({ settingKey: 'Notifications', settingValue: String(enabled), updatedAt: '' });
    await done;
  }

  async function login(response: AuthResponse): Promise<void> {
    const done = firstValueFrom(TestBed.inject(SessionService).login('mads', 'hemmelig1234'));
    http().expectOne(LOGIN).flush(response);
    await done;
  }

  beforeEach(() => {
    storage = createFakeStorage({ [STORAGE_KEY.SESSION]: AUTHENTICATED_SESSION });
    notifier = new FakeNotifier();
  });

  afterEach(() => {
    http().verify();
  });

  it('schedules the default evening reminder on start', async () => {
    const service = setup();
    await settle(service);

    expect(notifier.pendingIds()).toEqual([DAILY_LOG_ID]);
    expect(notifier.pending.get(DAILY_LOG_ID)?.time).toEqual({ hour: 21, minute: 0 });
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

    await setMaster(service, false);
    await settle(service);
    expect(notifier.pendingIds()).toEqual([]);

    await setMaster(service, true);
    await settle(service);
    expect(notifier.pendingIds()).toEqual([DAILY_LOG_ID]);
  });

  it('saves the master switch with PUT me/settings/Notifications – pessimistically', async () => {
    const service = setup();
    await settle(service);

    const done = firstValueFrom(service.setMasterEnabled(false));
    const request = http().expectOne({ method: 'PUT', url: NOTIFICATIONS_SETTING });
    expect(request.request.body).toEqual({ value: 'false' });
    expect(service.masterEnabled()).toBe(true);
    request.flush({ settingKey: 'Notifications', settingValue: 'false', updatedAt: '' });
    await done;

    expect(service.masterEnabled()).toBe(false);
  });

  it('keeps the master switch and asks for nothing when saving it fails', async () => {
    notifier.permission = 'prompt';
    const service = setup();
    TestBed.inject(UserProfileService).update({ notificationsEnabled: false });
    await settle(service);

    const done = firstValueFrom(service.setMasterEnabled(true));
    http().expectOne(NOTIFICATIONS_SETTING).flush(null, { status: 500, statusText: 'x' });

    await expect(done).rejects.toEqual({ messageKey: 'common.error.server', status: 500 });
    expect(service.masterEnabled()).toBe(false);
    expect(notifier.requests).toBe(0);
  });

  it('cancels everything on log out and schedules nothing while logged out', async () => {
    const service = setup();
    await settle(service);

    TestBed.inject(SessionService).logout().subscribe();
    http().expectOne('/api/v1/auth/logout').flush(null);
    await settle(service);

    expect(notifier.pendingIds()).toEqual([]);
  });

  it('schedules nothing while the e-mail waits for its verification', async () => {
    storage = createFakeStorage();
    const service = setup();
    const session = TestBed.inject(SessionService);

    session.login('mads', 'hemmelig1234').subscribe();
    http()
      .expectOne(LOGIN)
      .flush({ title: 'Forbidden', status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle(service);

    expect(session.status()).toBe('pending-verification');
    expect(notifier.pendingIds()).toEqual([]);
  });

  it('forgets the settings in memory only as a guest and brings them back on the next login', async () => {
    storage.setItem(STORAGE_KEY.REMINDERS, JSON.stringify(MORNING_ON));
    const service = setup();
    await settle(service);
    expect(service.settings().morgen.enabled).toBe(true);

    TestBed.inject(SessionService).logout().subscribe();
    http().expectOne('/api/v1/auth/logout').flush(null);
    await settle(service);

    expect(service.settings()).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.REMINDERS) ?? '{}')).toEqual(MORNING_ON);

    await login(TEST_AUTH_RESPONSE);
    await settle(service);
    expect(service.settings().morgen.enabled).toBe(true);
  });

  it('starts from the defaults once another account is authenticated', async () => {
    storage.setItem(STORAGE_KEY.REMINDERS, JSON.stringify(MORNING_ON));
    const service = setup();
    await settle(service);

    TestBed.inject(SessionService).logout().subscribe();
    http().expectOne('/api/v1/auth/logout').flush(null);
    await settle(service);
    await login(OTHER_ACCOUNT);
    await settle(service);

    expect(service.settings()).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(storage.getItem(STORAGE_KEY.REMINDERS)).toBeNull();
    expect(notifier.pendingIds()).toEqual([DAILY_LOG_ID]);
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
    const service = setup();

    expect(service.enabledCount()).toBe(1);
    service.update('morgen', { enabled: true });
    expect(service.enabledCount()).toBe(2);
  });
});
