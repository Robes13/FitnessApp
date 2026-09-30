import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_PROFILE } from '../../../../core/constants/profile-defaults';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import {
  ReminderNotifier,
  ReminderPermission,
  ScheduledReminder,
} from '../../../../core/models/reminder';
import { REMINDER_NOTIFIER } from '../../../../core/services/reminders/reminder-notifier';
import { ReminderService } from '../../../../core/services/reminders/reminders';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { AUTHENTICATED_SESSION } from '../../../../core/testing/fixtures';
import { ProfileRemindersSheet } from './profile-reminders-sheet';

class FakeNotifier implements ReminderNotifier {
  available = true;
  permission: ReminderPermission = 'granted';
  answer: ReminderPermission = 'granted';
  readonly pending = new Map<number, ScheduledReminder>();

  isAvailable(): boolean {
    return this.available;
  }
  async checkPermission(): Promise<ReminderPermission> {
    return this.permission;
  }
  async requestPermission(): Promise<ReminderPermission> {
    this.permission = this.answer;
    return this.permission;
  }
  async schedule(reminders: readonly ScheduledReminder[]): Promise<void> {
    for (const reminder of reminders) {
      this.pending.set(reminder.notificationId, reminder);
    }
  }
  async cancel(notificationIds: readonly number[]): Promise<void> {
    for (const id of notificationIds) {
      this.pending.delete(id);
    }
  }
}

@Component({
  imports: [ProfileRemindersSheet],
  template: `<app-profile-reminders-sheet [open]="open()" (closed)="open.set(false)" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly open = signal(true);
}

describe('ProfileRemindersSheet', () => {
  let notifier: FakeNotifier;

  beforeEach(() => {
    notifier = new FakeNotifier();
    resetComponentTestStorage({
      [STORAGE_KEY.PROFILE]: DEFAULT_PROFILE,
      [STORAGE_KEY.SESSION]: AUTHENTICATED_SESSION,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  async function setup(): Promise<{ fixture: ComponentFixture<Host>; host: HTMLElement }> {
    TestBed.configureTestingModule({
      providers: [
        ...provideComponentTestEnvironment(),
        { provide: REMINDER_NOTIFIER, useValue: notifier },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    await settle(fixture);
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  async function settle(fixture: ComponentFixture<Host>): Promise<void> {
    await fixture.whenStable();
    await TestBed.inject(ReminderService).sync();
    await fixture.whenStable();
  }

  function switchFor(host: HTMLElement, label: string): HTMLButtonElement | null {
    return host.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${label}"]`);
  }

  it('lists the five reminders with their default times', async () => {
    const { host } = await setup();
    const labels = Array.from(host.querySelectorAll('.profile-reminders-sheet__label')).map(
      (element) => element.textContent?.trim(),
    );

    expect(labels).toEqual(['Morgenmad', 'Frokost', 'Aftensmad', 'Vejning', 'Dagens madlog']);
    expect(host.textContent).toContain('Hver dag kl. 21:00');
    expect(switchFor(host, 'Påmindelse om dagens madlog')?.getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('turns a reminder on and schedules it', async () => {
    const { fixture, host } = await setup();

    switchFor(host, 'Påmindelse om morgenmad')?.click();
    await settle(fixture);

    expect(TestBed.inject(ReminderService).settings().morgen.enabled).toBe(true);
    expect(notifier.pending.has(1001)).toBe(true);
    expect(
      host.querySelector('input[type="time"][aria-label="Tidspunkt for morgenmad"]'),
    ).not.toBeNull();
  });

  it('saves a new time from the time field', async () => {
    const { fixture, host } = await setup();
    const input = host.querySelector<HTMLInputElement>(
      'input[type="time"][aria-label="Tidspunkt for dagens madlog"]',
    );

    expect(input?.value).toBe('21:00');
    if (input) {
      input.value = '20:15';
      input.dispatchEvent(new Event('input'));
    }
    await settle(fixture);

    expect(TestBed.inject(ReminderService).settings()['daily-log'].time).toEqual({
      hour: 20,
      minute: 15,
    });
    expect(notifier.pending.get(1005)?.time).toEqual({ hour: 20, minute: 15 });
  });

  it('lets the weigh-in be limited to one weekday', async () => {
    const { fixture, host } = await setup();
    switchFor(host, 'Påmindelse om vejning')?.click();
    await settle(fixture);

    Array.from(host.querySelectorAll<HTMLButtonElement>('button[app-ui-chip]'))
      .find((chip) => chip.textContent?.trim() === 'Man')
      ?.click();
    await settle(fixture);

    expect(notifier.pending.get(1004)?.weekday).toBe(0);
    expect(host.textContent).toContain('Mandag kl. 07:30');
  });

  it('locks the switches and explains a denied permission', async () => {
    notifier.permission = 'denied';
    const { host } = await setup();

    expect(host.textContent).toContain('Appen har ikke lov til at sende notifikationer');
    expect(switchFor(host, 'Påmindelse om morgenmad')?.disabled).toBe(true);
  });

  it('asks for permission from the notice', async () => {
    notifier.permission = 'prompt';
    const { fixture, host } = await setup();

    const allow = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Tillad notifikationer',
    );
    allow?.click();
    await settle(fixture);

    expect(TestBed.inject(ReminderService).permission()).toBe('granted');
    expect(notifier.pending.has(1005)).toBe(true);
    expect(host.textContent).not.toContain('Tillad notifikationer');
  });

  it('locks the switches while the master switch is off and can turn it back on', async () => {
    resetComponentTestStorage({
      [STORAGE_KEY.PROFILE]: { ...DEFAULT_PROFILE, notificationsEnabled: false },
      [STORAGE_KEY.SESSION]: AUTHENTICATED_SESSION,
    });
    const { fixture, host } = await setup();

    expect(host.textContent).toContain('Notifikationer er slået fra');
    expect(switchFor(host, 'Påmindelse om frokost')?.disabled).toBe(true);

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Slå notifikationer til')
      ?.click();
    await settle(fixture);

    expect(switchFor(host, 'Påmindelse om frokost')?.disabled).toBe(false);
    expect(notifier.pending.has(1005)).toBe(true);
  });

  it('keeps the switches usable in the browser and says reminders need the app', async () => {
    notifier.available = false;
    const { fixture, host } = await setup();

    expect(host.textContent).toContain('Påmindelser virker kun i appen');
    switchFor(host, 'Påmindelse om frokost')?.click();
    await settle(fixture);

    expect(TestBed.inject(ReminderService).settings().frokost.enabled).toBe(true);
  });
});
