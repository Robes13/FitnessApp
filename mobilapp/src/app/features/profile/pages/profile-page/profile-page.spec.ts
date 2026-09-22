import { ChangeDetectionStrategy, Component, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session';
import { ThemeService } from '../../../../core/services/theme';
import { UserProfileService } from '../../../../core/services/user-profile';
import { ProfilePage } from './profile-page';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

/**
 * Komponenttests bruger `provideComponentTestEnvironment()`: jsdom's rigtige `DOCUMENT`,
 * fastfrosset `NOW` og 0 ms mock-forsinkelser. Browserens storage ryddes pr. test.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Blank {}

/** Lader et `timer(0)` fra mock-backenden løbe færdigt. */
function flushMicroTimers(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('ProfilePage', () => {
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
      'Adgangskode',
      'Enheder',
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

  it('asks before logging out and then sends the user to login', async () => {
    const { fixture, host, router } = await setup();
    const session = TestBed.inject(SessionService);
    session.login('mads', 'hemmeligt').subscribe();
    await flushMicroTimers();
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
});
