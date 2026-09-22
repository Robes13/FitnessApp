import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE, QUERY_PARAM } from '../../../../core/constants/app-route';
import { FoodLogService } from '../../../../core/services/food-log';
import { UserProfileService } from '../../../../core/services/user-profile';
import { FOOD_ROUTES } from '../../food.routes';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

/**
 * Siden tegnes i den rigtige (jsdom-)DOM, fordi ark og scanner læser `document.activeElement`.
 * Kun timere og "nu" overstyres; storage ryddes pr. test, så `FoodLogService` seeder demo-loggen.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

const ROUTES: Routes = [{ path: APP_ROUTE.FOOD, children: FOOD_ROUTES }];

/** Fast dagsmål, så makroprocenterne er de samme i hver kørsel. */
const KCAL_TARGET = 2000;

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('FoodPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function setup(url: string = APP_PATH.FOOD) {
    TestBed.configureTestingModule({
      providers: [...TEST_PROVIDERS, provideRouter(ROUTES, withComponentInputBinding())],
    });
    TestBed.inject(UserProfileService).update({ kcalOverride: KCAL_TARGET });
    const harness = await RouterTestingHarness.create(url);
    const page = harness.routeNativeElement as HTMLElement;

    const settle = async (): Promise<void> => {
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await harness.fixture.whenStable();
    };

    await settle();
    return {
      harness,
      page,
      settle,
      text: (selector: string) => normalize(page.querySelector(selector)?.textContent),
      texts: (selector: string) =>
        Array.from(page.querySelectorAll(selector)).map((node) => normalize(node.textContent)),
    };
  }

  it('shows the day, the kcal ring and the four meal groups', async () => {
    const { page, text, texts } = await setup();

    expect(text('.food-page__title')).toBe('Dagens mad');
    expect(text('.food-page__date')).toBe('Mandag 21. sep');
    expect(text('.food-page__summary-label')).toBe('Tilbage i dag');
    expect(texts('.food-meal-group__label')).toEqual([
      'Morgenmad',
      'Frokost',
      'Aftensmad',
      'Snacks',
    ]);
    expect(text('.food-page__summary-value')).toBe('1170kcal');
    expect(texts('.food-page__macro-head span')).toEqual([
      'Protein',
      '49%',
      'Kulhydrat',
      '25%',
      'Fedt',
      '55%',
    ]);
    expect(texts('.food-page__macro-text')).toEqual(['73 / 150 g', '56 / 225 g', '31 / 56 g']);
    expect(texts('.food-meal-group__name-text')).toEqual(['Skyr-bowl med bær', 'Kyllingesalat']);
    expect(page.querySelector('.food-page__clearance')).not.toBeNull();
  });

  it('removes a logged item from its meal group', async () => {
    const { page, settle, texts } = await setup();

    page.querySelector<HTMLButtonElement>('.food-meal-group__remove')?.click();
    await settle();

    expect(texts('.food-meal-group__name-text')).toEqual(['Kyllingesalat']);
    expect(TestBed.inject(FoodLogService).entries()).toHaveLength(1);
  });

  it('opens the add sheet on the meal from the query param and clears it again', async () => {
    const { page } = await setup(`${APP_PATH.FOOD}?${QUERY_PARAM.ADD_MEAL}=frokost`);

    expect(normalize(page.querySelector('.ui-sheet__title')?.textContent)).toBe('Tilføj frokost');
    expect(TestBed.inject(Router).url).toBe(APP_PATH.FOOD);
  });

  it('opens the add sheet on the meal behind "+ Tilføj til aftensmad"', async () => {
    const { page, settle } = await setup();

    const addLinks = Array.from(page.querySelectorAll<HTMLButtonElement>('.food-meal-group__add'));
    addLinks[2]?.click();
    await settle();

    expect(normalize(page.querySelector('.ui-sheet__title')?.textContent)).toBe('Tilføj aftensmad');
  });

  it('opens the scanner from the round scan button', async () => {
    const { page, settle } = await setup();

    page.querySelector<HTMLButtonElement>('.food-page__scan')?.click();
    await settle();

    expect(page.querySelector('.barcode-scanner__overlay')).not.toBeNull();
  });
});
