import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { APP_PATH, QUERY_PARAM } from './core/constants/app-route';
import { STORAGE_KEY } from './core/constants/storage-key';
import { SessionService } from './core/services/session';
import { ThemeService } from './core/services/theme';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from './core/testing/test-providers';

/**
 * Sammenkoblingen mellem features. Hver feature tester sine egne skærme; her testes kun de
 * steder, hvor to features møder hinanden gennem `core` – dybe links, tab barens synlighed,
 * sessionens indflydelse på Hjem og temaskiftet. Testene kører på de rigtige `routes`, så en
 * ændret sti eller et ændret query-parameternavn fanges her.
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
      [STORAGE_KEY.SESSION]: { isLoggedIn: true, isEmailVerified: true },
    });
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

  it('skjuler tab baren på en opskrift (ROUTE_DATA.HIDE_TAB_BAR)', async () => {
    const { harness, root } = await navigateTo(APP_PATH.recipe('omelet'));
    expect(root.querySelector('app-ui-tab-bar')).toBeNull();

    // Tilbage til listen: baren kommer igen, så skjulningen følger den dybeste rute.
    await harness.navigateByUrl(APP_PATH.COLLECTIONS);
    await harness.fixture.whenStable();

    expect(root.querySelector('app-ui-tab-bar')).not.toBeNull();
  });

  it('viser bekræftelses-arket på Hjem, når mailen ikke er bekræftet', async () => {
    resetComponentTestStorage({
      [STORAGE_KEY.SESSION]: { isLoggedIn: true, isEmailVerified: false },
    });

    const { root } = await navigateTo(APP_PATH.HOME);

    expect(root.querySelector('.verify-email-sheet__badge')).not.toBeNull();
  });

  it('viser ikke bekræftelses-arket, når mailen er bekræftet', async () => {
    const { root } = await navigateTo(APP_PATH.HOME);

    expect(root.querySelector('.verify-email-sheet__badge')).toBeNull();
  });

  it('sender brugeren til login efter log ud', async () => {
    const { harness } = await navigateTo(APP_PATH.HOME);
    TestBed.inject(SessionService).logout();

    await harness.navigateByUrl(APP_PATH.PROFILE);

    expect(TestBed.inject(Router).url).toBe(APP_PATH.LOGIN);
  });

  it('sætter data-theme på <html>, når temaet skiftes', async () => {
    await navigateTo(APP_PATH.HOME);
    const theme = TestBed.inject(ThemeService);

    theme.set('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    theme.toggle();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
