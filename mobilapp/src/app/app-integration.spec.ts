import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { APP_PATH, QUERY_PARAM } from './core/constants/app-route';
import { STORAGE_KEY } from './core/constants/storage-key';
import { SessionService } from './core/services/session/session';
import { ThemeService } from './core/services/theme/theme';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from './core/testing/test-providers';
import { AUTHENTICATED_SESSION, TEST_EMAIL } from './core/testing/fixtures';

/**
 * The connections between features. Each feature tests its own screens; here only the
 * places where two features meet through `core` are tested – deep links, tab bar visibility,
 * the session's influence on Home, and theme switching. The tests run against the real
 * `routes`, so a changed path or a changed query parameter name is caught here.
 */
interface Harness {
  readonly harness: RouterTestingHarness;
  readonly root: HTMLElement;
}

async function navigateTo(url: string): Promise<Harness> {
  TestBed.configureTestingModule({
    providers: [
      ...provideComponentTestEnvironment(),
      provideRouter(routes, withComponentInputBinding()),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  return { harness, root: harness.fixture.nativeElement as HTMLElement };
}

describe('sammenkobling mellem features', () => {
  beforeEach(() => {
    resetComponentTestStorage({
      [STORAGE_KEY.SESSION]: AUTHENTICATED_SESSION,
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('åbner Mad-skærmens tilføj-ark på det måltid, Hjems gøremålskort peger på', async () => {
    const { root } = await navigateTo(`${APP_PATH.FOOD}?${QUERY_PARAM.ADD_MEAL}=aften`);

    const selectedChips = Array.from(
      root.querySelectorAll('.food-add-sheet__meal.ui-chip--selected'),
    ).map((chip) => (chip.textContent ?? '').trim());

    expect(root.querySelector('.ui-sheet__panel')).not.toBeNull();
    expect(selectedChips).toEqual(['Aftensmad']);
  });

  it('ignorerer et ukendt måltid i query-parameteren', async () => {
    const { root } = await navigateTo(`${APP_PATH.FOOD}?${QUERY_PARAM.ADD_MEAL}=findes-ikke`);

    expect(root.querySelector('.ui-sheet__panel')).toBeNull();
  });

  it('viser tab baren på Samlinger', async () => {
    const { root } = await navigateTo(APP_PATH.COLLECTIONS);

    expect(root.querySelector('app-ui-tab-bar')).not.toBeNull();
  });

  it('viser ingen tab bar på en opskrift', async () => {
    const { harness, root } = await navigateTo(APP_PATH.recipe('omelet'));
    expect(root.querySelector('app-ui-tab-bar')).toBeNull();

    // Back to the list: it is under the shell again, so the bar is back.
    await harness.navigateByUrl(APP_PATH.COLLECTIONS);
    await harness.fixture.whenStable();

    expect(root.querySelector('app-ui-tab-bar')).not.toBeNull();
  });

  it('viser bekræftelses-arket på Hjem, når mailen ikke er bekræftet', async () => {
    resetComponentTestStorage();
    const { harness, root } = await navigateTo(APP_PATH.LOGIN);
    // Right password, unverified e-mail: 403 without tokens → pending (only in memory).
    TestBed.inject(SessionService).login(TEST_EMAIL, 'hemmelig1234').subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush({ title: 'Forbidden', status: 403 }, { status: 403, statusText: 'Forbidden' });

    await harness.navigateByUrl(APP_PATH.HOME);
    await harness.fixture.whenStable();

    expect(root.querySelector('.verify-email-sheet__badge')).not.toBeNull();
  });

  it('viser ikke bekræftelses-arket, når mailen er bekræftet', async () => {
    const { root } = await navigateTo(APP_PATH.HOME);

    expect(root.querySelector('.verify-email-sheet__badge')).toBeNull();
  });

  it('sender brugeren til login efter log ud', async () => {
    const { harness } = await navigateTo(APP_PATH.HOME);
    TestBed.inject(SessionService).logout().subscribe();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/logout').flush(null);

    await harness.navigateByUrl(APP_PATH.PROFILE);

    expect(TestBed.inject(Router).url).toBe(APP_PATH.LOGIN);
  });

  it('sætter data-theme på <html>, når temaet skiftes', async () => {
    await navigateTo(APP_PATH.HOME);
    const theme = TestBed.inject(ThemeService);

    theme.set('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    theme.set('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
