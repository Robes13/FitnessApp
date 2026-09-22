import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { DEFAULT_DISPLAY_NAME } from '../../../../core/constants/demo-data';
import { SessionService } from '../../../../core/services/session';
import { HomePage } from './home-page';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

/**
 * Komponenttests bruger `provideComponentTestEnvironment()`: jsdom's rigtige `DOCUMENT`,
 * fastfrosset `NOW` og 0 ms mock-forsinkelser. Browserens storage ryddes pr. test.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function setup(): Promise<{ settle: () => Promise<void>; page: HTMLElement }> {
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([{ path: APP_ROUTE.HOME, component: HomePage }]),
      ],
    });
    const harness = await RouterTestingHarness.create(APP_PATH.HOME);
    const settle = async (): Promise<void> => {
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await harness.fixture.whenStable();
    };
    await settle();
    return { settle, page: harness.routeNativeElement as HTMLElement };
  }

  it('greets the user and links the avatar to the profile', async () => {
    const { page } = await setup();
    const avatar = page.querySelector('.home-page__avatar');

    expect(page.querySelector('.home-page__greeting')?.textContent?.trim()).toBe(
      `Hej, ${DEFAULT_DISPLAY_NAME}`,
    );
    expect(page.querySelector('.home-page__today')?.textContent?.trim()).toBe('Mandag 21. sep');
    expect(avatar?.getAttribute('href')).toBe(APP_PATH.PROFILE);
    expect(avatar?.textContent?.trim()).toBe('M');
  });

  it('renders the week rings, the next step and the day, goal and week cards', async () => {
    const { page } = await setup();

    expect(page.querySelectorAll('.home-week-rings__day')).toHaveLength(7);
    expect(page.querySelector('.home-todo-card__title')?.textContent?.trim()).toBe(
      'Husk at veje dig i dag',
    );
    expect(page.querySelector('app-home-day-card')).not.toBeNull();
    expect(page.querySelector('app-home-week-card')).not.toBeNull();
    // Standardprofilen har intet mål valgt, så målkortet er ikke skjult.
    expect(page.querySelector('app-home-goal-card')).not.toBeNull();
  });

  it('locks the screen with the verify sheet until the e-mail is confirmed', async () => {
    const { settle, page } = await setup();

    expect(page.querySelector('.ui-sheet__panel')).not.toBeNull();

    TestBed.inject(SessionService).markEmailVerified();
    await settle();

    expect(page.querySelector('.ui-sheet__panel')).toBeNull();
  });

  it('does not celebrate before the target is reached', async () => {
    const { page } = await setup();

    expect(page.querySelector('app-home-celebration-toast')).toBeNull();
  });
});
