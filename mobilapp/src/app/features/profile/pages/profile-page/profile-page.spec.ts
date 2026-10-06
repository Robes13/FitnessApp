import { ChangeDetectionStrategy, Component, Provider } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { EMPTY, Subject, throwError } from 'rxjs';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session/session';
import { ThemeService } from '../../../../core/services/theme/theme';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { DEFAULT_PROFILE } from '../../../../core/constants/profile-defaults';
import { PrivacyService } from '../../services/privacy';
import { ProfilePage } from './profile-page';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import {
  AUTHENTICATED_SESSION,
  TEST_AUTH_RESPONSE,
  TEST_GOAL,
} from '../../../../core/testing/fixtures';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`, a
 * frozen `NOW`, and 0 ms artificial delays. The app has no demo profile, so the tests
 * give the profile service a filled-in profile themselves.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];
const NOTIFICATIONS_SETTING = '/api/v1/me/settings/Notifications';

const STORED_PROFILE = {
  ...DEFAULT_PROFILE,
  username: 'Mads',
  email: 'dig@mail.dk',
  trainingDays: [true, false, true, false, true, false, false],
};

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Blank {}

describe('ProfilePage', () => {
  beforeEach(() => {
    resetComponentTestStorage({ [STORAGE_KEY.SESSION]: AUTHENTICATED_SESSION });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  async function setup(): Promise<{
    fixture: ComponentFixture<ProfilePage>;
    host: HTMLElement;
    router: Router;
  }> {
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([
          { path: APP_ROUTE.LOGIN, component: Blank },
          { path: APP_ROUTE.HOME, component: Blank },
        ]),
      ],
    });
    TestBed.inject(UserProfileService).replace(STORED_PROFILE);
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  /** Answers the five calls of the profile's `load()`; `fail` makes `GET me` fail. */
  function flushProfileLoad(fail = false): void {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/me/profile').flush({
      birthDate: '1998-05-16',
      gender: 'Male',
      height: 180,
      dailySteps: 6000,
      trainingDaysPerWeek: 0,
      workoutDurationMinutes: 45,
      trainingIntensity: 'Moderate',
      profileImageUrl: null,
    });
    http.expectOne('/api/v1/me/goals/recalculate').flush(TEST_GOAL);
    http.expectOne('/api/v1/me/settings').flush([]);
    http
      .expectOne('/api/v1/me/weight-logs/latest')
      .flush({ weightLogId: null, weight: 80, recordedAt: '', isStartingWeight: true });
    http
      .expectOne('/api/v1/me')
      .flush(
        fail ? null : { ...TEST_AUTH_RESPONSE.user, username: 'Mads' },
        fail ? { status: 500, statusText: 'Server Error' } : undefined,
      );
  }

  function notificationsSwitch(host: HTMLElement): HTMLButtonElement | null {
    return host.querySelector<HTMLButtonElement>(
      '.profile-page__toggle [aria-label="Notifikationer"]',
    );
  }

  function rowButton(host: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(host.querySelectorAll<HTMLButtonElement>('button[app-ui-row-button]')).find(
      (element) => element.querySelector('.ui-row-button__label')?.textContent?.trim() === label,
    );
  }

  function rowLabels(host: HTMLElement): readonly string[] {
    return Array.from(host.querySelectorAll('button[app-ui-row-button] .ui-row-button__label')).map(
      (element) => element.textContent?.trim() ?? '',
    );
  }

  it('shows the header, the name and the three key figures', async () => {
    const { host } = await setup();

    expect(host.querySelector('app-ui-page-header')?.textContent).toContain('Profil');
    expect(host.querySelector('.profile-page__name')?.textContent?.trim()).toBe('Mads');
    expect(host.querySelector('.profile-page__email')?.textContent?.trim()).toBe('dig@mail.dk');
    expect(host.querySelector('.profile-page__stats')?.textContent).toContain('75');
    expect(host.querySelector('.profile-page__stats')?.textContent).toContain('178');
    expect(host.querySelector('.profile-page__stats')?.textContent).toContain('23,7');
  });

  it('lists the plan and the account rows', async () => {
    const { host } = await setup();

    expect(rowLabels(host)).toEqual([
      'Mål',
      'Tempo',
      'Fødselsdato',
      'Køn',
      'Højde',
      'Aktivitet',
      'Træningsdage',
      'Længde',
      'Intensitet',
      'Dagligt kaloriemål',
      'E-mail',
      'Påmindelser',
      'Download mine data',
      'Servicevilkår og behandling af sundheds- og profildata',
    ]);
  });

  it("shows the calorie target without a chevron and doesn't open the sheet for it", async () => {
    const { fixture, host } = await setup();
    const kcalRow = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((element) =>
      element.textContent?.includes('Dagligt kaloriemål'),
    );

    expect(kcalRow?.querySelector('.ui-row-button__chevron')).toBeNull();
    expect(kcalRow?.disabled).toBe(true);
    kcalRow?.click();
    await fixture.whenStable();

    expect(host.querySelector('app-profile-edit-sheet [role="dialog"]')).toBeNull();
  });

  it('shows a spinner while the profile loads, and an error with "Prøv igen" when it fails', async () => {
    const { fixture, host } = await setup();
    const profiles = TestBed.inject(UserProfileService);

    profiles.load().subscribe();
    await fixture.whenStable();
    expect(host.querySelector('.profile-page__status app-ui-spinner')).not.toBeNull();
    expect(host.querySelector('.profile-page__stats')).toBeNull();

    flushProfileLoad(true);
    await fixture.whenStable();
    expect(host.querySelector('.profile-page__status')?.textContent).toContain(
      'Profilen kunne ikke hentes.',
    );

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((element) => element.textContent?.trim() === 'Prøv igen')
      ?.click();
    flushProfileLoad();
    await fixture.whenStable();

    expect(host.querySelector('.profile-page__status')).toBeNull();
    expect(host.querySelector('.profile-page__stats')?.textContent).toContain('180');
  });

  it('renders the twelve achievements', async () => {
    const { host } = await setup();

    expect(host.querySelectorAll('.achievements__item').length).toBe(12);
  });

  it('opens the edit sheet for the row that was tapped', async () => {
    const { fixture, host } = await setup();

    const heightRow = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (element) => element.textContent?.includes('Højde'),
    );
    heightRow?.click();
    await fixture.whenStable();

    expect(host.querySelector('app-profile-edit-sheet [role="dialog"]')?.textContent).toContain(
      'Højde',
    );
  });

  it('drives the theme from the "Lys tilstand" switch', async () => {
    const { fixture, host } = await setup();
    const theme = TestBed.inject(ThemeService);
    const toggle = host.querySelector<HTMLButtonElement>(
      '.profile-page__toggle [aria-label="Lys tilstand"]',
    );

    expect(theme.isLight()).toBe(false);
    toggle?.click();
    await fixture.whenStable();

    expect(theme.isLight()).toBe(true);
  });

  it('saves the notification switch in the API and locks it meanwhile', async () => {
    const { fixture, host } = await setup();
    const profiles = TestBed.inject(UserProfileService);
    const toggle = notificationsSwitch(host);

    expect(profiles.profile().notificationsEnabled).toBe(true);
    toggle?.click();
    await fixture.whenStable();
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(toggle?.disabled).toBe(true);
    const request = TestBed.inject(HttpTestingController).expectOne({
      method: 'PUT',
      url: NOTIFICATIONS_SETTING,
    });
    expect(request.request.body).toEqual({ value: 'false' });
    expect(profiles.profile().notificationsEnabled).toBe(true);
    request.flush({ settingKey: 'Notifications', settingValue: 'false', updatedAt: '' });
    await fixture.whenStable();

    expect(profiles.profile().notificationsEnabled).toBe(false);
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(toggle?.disabled).toBe(false);
  });

  it('flips the notification switch back and says why when saving fails', async () => {
    const { fixture, host } = await setup();
    const toggle = notificationsSwitch(host);

    toggle?.click();
    await fixture.whenStable();
    TestBed.inject(HttpTestingController)
      .expectOne(NOTIFICATIONS_SETTING)
      .error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(toggle?.getAttribute('aria-checked')).toBe('true');
    expect(
      host.querySelector('.profile-page__section app-ui-form-error')?.textContent?.trim(),
    ).toBe('Ingen forbindelse. Tjek dit internet, og prøv igen.');
  });

  it('downloads the data from "Privatliv" and disables the row meanwhile', async () => {
    const { fixture, host } = await setup();
    const result = new Subject<void>();
    const download = vi
      .spyOn(fixture.debugElement.injector.get(PrivacyService), 'downloadMyData')
      .mockReturnValue(result);
    const row = rowButton(host, 'Download mine data');

    row?.click();
    await fixture.whenStable();
    expect(download).toHaveBeenCalledOnce();
    expect(row?.disabled).toBe(true);

    result.error({ messageKey: 'common.error.server', status: 500 });
    await fixture.whenStable();
    expect(row?.disabled).toBe(false);
    expect(row?.parentElement?.querySelector('app-ui-form-error')?.textContent?.trim()).toBe(
      'Serveren svarer ikke lige nu. Prøv igen om lidt.',
    );
  });

  it('withdraws the consent from "Privatliv" after the deletion sheet explains it', async () => {
    const { fixture, host } = await setup();
    const session = TestBed.inject(SessionService);
    const withdraw = vi.spyOn(session, 'withdrawConsent').mockReturnValue(EMPTY);
    const deleteAccount = vi.spyOn(session, 'deleteAccount');
    const row = rowButton(host, 'Servicevilkår og behandling af sundheds- og profildata');

    expect(row?.textContent).toContain('Træk tilbage');
    row?.click();
    await fixture.whenStable();
    const sheet = host.querySelector('app-ui-confirm-sheet [role="dialog"]');
    expect(sheet?.textContent).toContain('Samtykket er en forudsætning for Nutrify.');
    expect(withdraw).not.toHaveBeenCalled();

    Array.from(sheet?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((element) => element.textContent?.trim() === 'Ja, slet min konto')
      ?.click();
    await fixture.whenStable();

    expect(withdraw).toHaveBeenCalledOnce();
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(sheet?.querySelector('app-ui-spinner')).not.toBeNull();
  });

  it('opens the reminders sheet from the "Påmindelser" row', async () => {
    const { fixture, host } = await setup();
    const row = Array.from(
      host.querySelectorAll<HTMLButtonElement>('button[app-ui-row-button]'),
    ).find((element) => element.textContent?.includes('Påmindelser'));

    expect(row?.textContent).toContain('1 aktiv');
    row?.click();
    await fixture.whenStable();

    const sheet = host.querySelector('app-profile-reminders-sheet [role="dialog"]');
    expect(sheet?.textContent).toContain('Dagens madlog');
    expect(sheet?.textContent).toContain('kun i appen');
  });

  it('asks before logging out and then sends the user to login', async () => {
    const { fixture, host, router } = await setup();
    const session = TestBed.inject(SessionService);
    expect(session.isLoggedIn()).toBe(true);

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((element) => element.textContent?.trim() === 'Log ud')
      ?.click();
    await fixture.whenStable();

    const sheet = host.querySelector('app-ui-confirm-sheet [role="dialog"]');
    expect(sheet?.textContent).toContain('Dine data bliver gemt.');

    Array.from(sheet?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((element) => element.textContent?.trim() === 'Ja, log mig ud')
      ?.click();
    await fixture.whenStable();
    expect(sheet?.querySelector('app-ui-spinner')).not.toBeNull();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/logout')
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(session.isLoggedIn()).toBe(false);
    expect(router.url).toBe(APP_PATH.LOGIN);
  });

  it('asks before deleting the account and then deletes it', async () => {
    const { fixture, host } = await setup();
    const session = TestBed.inject(SessionService);
    const deleteAccount = vi.spyOn(session, 'deleteAccount').mockReturnValue(EMPTY);

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((element) => element.textContent?.trim() === 'Slet konto')
      ?.click();
    await fixture.whenStable();

    const sheet = host.querySelector('app-ui-confirm-sheet [role="dialog"]');
    expect(sheet?.textContent).toContain('Din konto og alle dine data bliver slettet');
    expect(deleteAccount).not.toHaveBeenCalled();

    Array.from(sheet?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((element) => element.textContent?.trim() === 'Ja, slet min konto')
      ?.click();
    await fixture.whenStable();

    expect(deleteAccount).toHaveBeenCalledOnce();
    // The app reloads at login on success, so the sheet stays busy until then.
    expect(sheet?.querySelector('app-ui-spinner')).not.toBeNull();
  });

  it('shows why the account could not be deleted and keeps the sheet open', async () => {
    const { fixture, host } = await setup();
    const session = TestBed.inject(SessionService);
    vi.spyOn(session, 'deleteAccount').mockReturnValue(
      throwError(() => ({ messageKey: 'common.error.network', status: 0 })),
    );

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((element) => element.textContent?.trim() === 'Slet konto')
      ?.click();
    await fixture.whenStable();
    const sheet = host.querySelector('app-ui-confirm-sheet [role="dialog"]');
    Array.from(sheet?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((element) => element.textContent?.trim() === 'Ja, slet min konto')
      ?.click();
    await fixture.whenStable();

    expect(sheet?.querySelector('app-ui-form-error')?.textContent?.trim()).toBe(
      'Ingen forbindelse. Tjek dit internet, og prøv igen.',
    );
    expect(sheet?.querySelector('app-ui-spinner')).toBeNull();
    expect(session.isAuthenticated()).toBe(true);
  });
});
