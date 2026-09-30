import { ChangeDetectionStrategy, Component, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session/session';
import { ThemeService } from '../../../../core/services/theme/theme';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { DEFAULT_PROFILE } from '../../../../core/constants/profile-defaults';
import { ProfilePage } from './profile-page';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`, a
 * frozen `NOW`, and 0 ms artificial delays. The app has no demo profile, so the tests
 * put a filled-in profile in storage themselves.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

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
    resetComponentTestStorage({
      [STORAGE_KEY.PROFILE]: STORED_PROFILE,
      [STORAGE_KEY.SESSION]: { isLoggedIn: true, isEmailVerified: true },
    });
  });

  afterEach(() => {
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
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
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
      'Køn',
      'Højde',
      'Aktivitet',
      'Træningsdage',
      'Længde',
      'Intensitet',
      'Dagligt kaloriemål',
      'E-mail',
      'Enheder',
      'Påmindelser',
    ]);
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

  it('stores the notification switch on the profile', async () => {
    const { fixture, host } = await setup();
    const profiles = TestBed.inject(UserProfileService);
    const toggle = host.querySelector<HTMLButtonElement>(
      '.profile-page__toggle [aria-label="Notifikationer"]',
    );

    expect(profiles.profile().notificationsEnabled).toBe(true);
    toggle?.click();
    await fixture.whenStable();

    expect(profiles.profile().notificationsEnabled).toBe(false);
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

    const sheet = host.querySelector('app-profile-logout-sheet');
    expect(sheet?.textContent).toContain('Dine data bliver gemt.');

    Array.from(sheet?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((element) => element.textContent?.trim() === 'Ja, log mig ud')
      ?.click();
    await fixture.whenStable();

    expect(session.isLoggedIn()).toBe(false);
    expect(router.url).toBe(APP_PATH.LOGIN);
  });

  it('asks before deleting the account and then deletes it', async () => {
    const { fixture, host } = await setup();
    const session = TestBed.inject(SessionService);
    const deleteAccount = vi.spyOn(session, 'deleteAccount').mockImplementation(() => undefined);

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((element) => element.textContent?.trim() === 'Slet konto')
      ?.click();
    await fixture.whenStable();

    const sheet = host.querySelector('app-profile-delete-account-sheet');
    expect(sheet?.textContent).toContain('Alle dine data på denne enhed bliver slettet');
    expect(deleteAccount).not.toHaveBeenCalled();

    Array.from(sheet?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((element) => element.textContent?.trim() === 'Ja, slet min konto')
      ?.click();
    await fixture.whenStable();

    expect(deleteAccount).toHaveBeenCalledOnce();
  });
});
