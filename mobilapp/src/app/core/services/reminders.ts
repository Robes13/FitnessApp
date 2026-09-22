import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  Signal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  DEFAULT_REMINDER_SETTINGS,
  REMINDER_DEFINITIONS,
  REMINDER_ERROR,
  REMINDER_IDS,
  REMINDER_NOTIFICATION_IDS,
} from '../constants/reminders';
import { STORAGE_KEY } from '../constants/storage-key';
import { DAYS_PER_WEEK } from '../constants/time';
import {
  ReminderId,
  ReminderPermission,
  ReminderSetting,
  ReminderSettings,
  ScheduledReminder,
  WeekdayIndex,
} from '../models/reminder';
import { isClockTime } from '../utils/clock-time';
import { REMINDER_NOTIFIER } from './reminder-notifier';
import { SessionService } from './session';
import { StorageService } from './storage';
import { UserProfileService } from './user-profile';

/** Permission states where asking the user can still change the answer. */
const ASKABLE_PERMISSIONS: readonly ReminderPermission[] = ['unknown', 'prompt'];

/**
 * The user's reminders and their local notifications.
 *
 * The settings (on/off, time, weekday per kind) are saved in storage. Notifications are
 * delivered only when the user is logged in, the profile's "Notifikationer" master switch
 * (`notificationsEnabled`) is on and the platform permission is granted.
 *
 * Scheduling is idempotent: every sync cancels all of the app's fixed notification ids and
 * schedules the enabled ones again. A sync runs on start (the effect's first run), whenever
 * the settings, the master switch or the login state change, after a permission request and
 * when the app returns to the foreground (the user may have changed the permission in the
 * phone's settings). Logging out – and the reload after deleting the account – therefore
 * cancels everything.
 *
 * Permission is never requested on its own; only when the user turns a reminder or the
 * master switch on (`update`, `setMasterEnabled`, `requestPermission`).
 *
 * In the browser the plugin isn't available: settings are still saved, `permission` is
 * `unsupported` and nothing is scheduled.
 */
@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);
  private readonly profiles = inject(UserProfileService);
  private readonly session = inject(SessionService);
  private readonly notifier = inject(REMINDER_NOTIFIER);

  private readonly settingsState = signal<ReminderSettings>(this.restore());
  private readonly permissionState = signal<ReminderPermission>(
    this.notifier.isAvailable() ? 'unknown' : 'unsupported',
  );
  private readonly scheduleErrorState = signal<string | null>(null);
  /**
   * The permission state when asking for permission failed, else `null`. That error stays until
   * the permission changes – a sync afterwards (e.g. the one queued by the same toggle) must not
   * clear it before the user has seen it.
   */
  private readonly permissionErrorFor = signal<ReminderPermission | null>(null);
  /** Syncs run one at a time, so a cancel from one can't land after the schedule of the next. */
  private queue: Promise<void> = Promise.resolve();

  readonly settings: Signal<ReminderSettings> = this.settingsState.asReadonly();
  readonly permission: Signal<ReminderPermission> = this.permissionState.asReadonly();
  /** Danish, user-facing text when scheduling or asking for permission failed, else `null`. */
  readonly error: Signal<string | null> = computed(() =>
    this.permissionErrorFor() === null ? this.scheduleErrorState() : REMINDER_ERROR.PERMISSION,
  );
  readonly isSupported = computed(() => this.permissionState() !== 'unsupported');
  readonly masterEnabled = computed(() => this.profiles.profile().notificationsEnabled);
  readonly enabledCount = computed(
    () => REMINDER_IDS.filter((id) => this.settingsState()[id].enabled).length,
  );
  /** Whether enabled reminders actually reach the phone right now. */
  readonly isDelivering = computed(() => this.shouldDeliver(this.permissionState()));

  constructor() {
    effect(() => {
      // Everything that decides which notifications should exist.
      this.settingsState();
      this.masterEnabled();
      this.session.isLoggedIn();
      untracked(() => void this.sync());
    });

    const onVisibilityChange = (): void => {
      if (this.document.visibilityState === 'visible') {
        void this.sync();
      }
    };
    this.document.addEventListener?.('visibilitychange', onVisibilityChange);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener?.('visibilitychange', onVisibilityChange);
    });
  }

  /** Changes one reminder. Turning it on asks for permission, if that hasn't been answered yet. */
  update(id: ReminderId, patch: Partial<ReminderSetting>): void {
    const settings = this.settingsState();
    const next: ReminderSettings = { ...settings, [id]: { ...settings[id], ...patch } };
    this.settingsState.set(next);
    this.storage.write(STORAGE_KEY.REMINDERS, next);
    if (patch.enabled === true) {
      void this.requestPermissionIfAskable();
    }
  }

  /** The profile's "Notifikationer" switch. Turning it on asks for permission, if needed. */
  setMasterEnabled(enabled: boolean): void {
    this.profiles.update({ notificationsEnabled: enabled });
    if (enabled) {
      void this.requestPermissionIfAskable();
    }
  }

  /** Shows the platform's permission dialog (once – after that the platform answers directly). */
  async requestPermission(): Promise<ReminderPermission> {
    if (!this.notifier.isAvailable()) {
      this.setPermission('unsupported');
      return 'unsupported';
    }
    try {
      const permission = await this.notifier.requestPermission();
      this.permissionErrorFor.set(null);
      this.setPermission(permission);
    } catch (error: unknown) {
      console.error('ReminderService kunne ikke bede om lov til notifikationer.', error);
      this.permissionErrorFor.set(this.permissionState());
      return this.permissionState();
    }
    await this.sync();
    return this.permissionState();
  }

  /** Cancels and reschedules all reminders from the current state. Never rejects. */
  sync(): Promise<void> {
    this.queue = this.queue.then(() => this.applySchedule());
    return this.queue;
  }

  private async requestPermissionIfAskable(): Promise<void> {
    if (ASKABLE_PERMISSIONS.includes(this.permissionState())) {
      await this.requestPermission();
    }
  }

  private async applySchedule(): Promise<void> {
    if (!this.notifier.isAvailable()) {
      this.setPermission('unsupported');
      return;
    }
    try {
      const permission = await this.notifier.checkPermission();
      this.setPermission(permission);
      await this.notifier.cancel(REMINDER_NOTIFICATION_IDS);
      if (this.shouldDeliver(permission)) {
        await this.notifier.schedule(this.dueReminders());
      }
      this.scheduleErrorState.set(null);
    } catch (error: unknown) {
      console.error('ReminderService kunne ikke planlægge påmindelserne.', error);
      this.scheduleErrorState.set(REMINDER_ERROR.SCHEDULE);
    }
  }

  /** Sets the permission and drops a permission error once the permission has changed. */
  private setPermission(permission: ReminderPermission): void {
    const failedAt = this.permissionErrorFor();
    if (failedAt !== null && failedAt !== permission) {
      this.permissionErrorFor.set(null);
    }
    this.permissionState.set(permission);
  }

  private shouldDeliver(permission: ReminderPermission): boolean {
    return this.session.isLoggedIn() && this.masterEnabled() && permission === 'granted';
  }

  private dueReminders(): readonly ScheduledReminder[] {
    const settings = this.settingsState();
    return REMINDER_DEFINITIONS.filter((definition) => settings[definition.id].enabled).map(
      (definition): ScheduledReminder => {
        const setting = settings[definition.id];
        return {
          notificationId: definition.notificationId,
          title: definition.title,
          body: definition.body,
          time: setting.time,
          weekday: definition.allowsWeekday ? setting.weekday : null,
        };
      },
    );
  }

  /** Missing or invalid fields fall back to the defaults, so older or damaged data still loads. */
  private restore(): ReminderSettings {
    const stored = this.storage.read<Partial<Record<ReminderId, unknown>>>(STORAGE_KEY.REMINDERS);
    const value = typeof stored === 'object' && stored !== null ? stored : {};
    return {
      morgen: restoreSetting(value.morgen, DEFAULT_REMINDER_SETTINGS.morgen),
      frokost: restoreSetting(value.frokost, DEFAULT_REMINDER_SETTINGS.frokost),
      aften: restoreSetting(value.aften, DEFAULT_REMINDER_SETTINGS.aften),
      'weigh-in': restoreSetting(value['weigh-in'], DEFAULT_REMINDER_SETTINGS['weigh-in']),
      'daily-log': restoreSetting(value['daily-log'], DEFAULT_REMINDER_SETTINGS['daily-log']),
    };
  }
}

function restoreSetting(value: unknown, fallback: ReminderSetting): ReminderSetting {
  if (typeof value !== 'object' || value === null) {
    return fallback;
  }
  const { enabled, time, weekday } = value as Partial<Record<keyof ReminderSetting, unknown>>;
  return {
    enabled: typeof enabled === 'boolean' ? enabled : fallback.enabled,
    time: isClockTime(time) ? { hour: time.hour, minute: time.minute } : fallback.time,
    weekday: weekday === null || isWeekdayIndex(weekday) ? weekday : fallback.weekday,
  };
}

function isWeekdayIndex(value: unknown): value is WeekdayIndex {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < DAYS_PER_WEEK
  );
}
