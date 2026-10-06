import { Component, EnvironmentProviders, Provider } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE, ROUTE_PARAM } from '../../../../core/constants/app-route';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import { COLLECTIONS_ROUTES, RECIPE_ROUTES } from '../../collections.routes';
import {
  TEST_FOOD,
  flushTestCollections,
  flushTestFoodLog,
  testCollection,
  testFood,
  testFoodLog,
} from '../../../../core/testing/fixtures';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  { path: APP_ROUTE.FOOD, component: Blank },
  { path: `${APP_ROUTE.COLLECTIONS}/:${ROUTE_PARAM.RECIPE_ID}`, children: RECIPE_ROUTES },
  { path: APP_ROUTE.COLLECTIONS, children: COLLECTIONS_ROUTES },
];

const TEST_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideRouter(ROUTES, withComponentInputBinding()),
  ...provideComponentTestEnvironment(),
];

const COLLECTION_URL = '/api/v1/me/meal-collections/3';
const BUNDLE_ID = '3';
const MEAL_PREP = testCollection(3, 'Meal prep', [
  { foodId: 5, foodName: 'Tunsalat', quantity: 200, unit: 'Gram' },
]);

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('RecipePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Tunsalat 200 g = 240 kcal, 28 g protein, 6 g carbs, 11 g fat. */
  function loadMealPrep(collection = MEAL_PREP): void {
    flushTestFoodLog([
      testFood({
        foodId: 5,
        name: 'Tunsalat',
        caloriesPer100: 120,
        proteinPer100: 14,
        carbohydratesPer100: 3,
        fatPer100: 5.5,
      }),
    ]);
    flushTestCollections([collection]);
  }

  async function setup(recipeId: string) {
    const harness = await RouterTestingHarness.create(APP_PATH.recipe(recipeId));
    const page = harness.routeNativeElement as HTMLElement;
    const text = (selector: string) => normalize(page.querySelector(selector)?.textContent);
    const texts = (selector: string) =>
      Array.from(page.querySelectorAll<HTMLElement>(selector)).map((el) =>
        normalize(el.textContent),
      );
    const button = (label: string) =>
      Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
        (el) => normalize(el.textContent) === label,
      );
    const mealOption = (label: string) =>
      Array.from(page.querySelectorAll('.meal-picker__option')).find(
        (el) => normalize(el.textContent) === label,
      );
    const settle = async () => {
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await harness.fixture.whenStable();
    };
    const click = async (element: Element | undefined | null) => {
      (element as HTMLElement | null)?.click();
      await settle();
    };
    return { harness, page, text, texts, button, mealOption, settle, click };
  }

  it('shows the macros and items of a collection', async () => {
    loadMealPrep();
    const { text, texts } = await setup(BUNDLE_ID);

    // A collection, not a recipe (P13).
    expect(text('.ui-page-header__title')).toBe('Samling');
    expect(text('.recipe-page__title')).toBe('Meal prep');
    expect(texts('.recipe-page__stat-value')).toEqual(['240', '28 g', '6 g', '11 g']);
    expect(texts('.recipe-page__line-qty')).toEqual(['200 g']);
    expect(text('.recipe-page__log-button')).toBe('Log 240 kcal');
  });

  it('writes kcal from 1000 up with a thousands separator', async () => {
    loadMealPrep(
      testCollection(3, 'Meal prep', [
        { foodId: 5, foodName: 'Tunsalat', quantity: 1000, unit: 'Gram' },
      ]),
    );
    const { text, texts } = await setup(BUNDLE_ID);

    expect(texts('.recipe-page__stat-value')).toEqual(['1.200', '140 g', '30 g', '55 g']);
    expect(text('.recipe-page__log-button')).toBe('Log 1.200 kcal');
  });

  it('logs the collection under the chosen meal in one call and switches to Mad', async () => {
    loadMealPrep();
    const { page, mealOption, click } = await setup(BUNDLE_ID);

    await click(mealOption('Aftensmad'));
    await click(page.querySelector('.recipe-page__log-button'));
    await click(page.querySelector('.recipe-page__log-button'));
    const log = http.expectOne({ method: 'POST', url: `${COLLECTION_URL}/log` });
    expect(log.request.body).toMatchObject({ mealType: 'Dinner', multiplier: 1 });
    log.flush([testFoodLog({ ...TEST_FOOD, name: 'Tunsalat', quantity: '200 g' }, 'aften')]);
    await click(null);

    expect(TestBed.inject(FoodLogService).entries()).toMatchObject([
      { name: 'Tunsalat', meal: 'aften' },
    ]);
    expect(TestBed.inject(Router).url).toBe(APP_PATH.FOOD);
  });

  it('stays on the page with a message when the log fails', async () => {
    loadMealPrep();
    const { page, text, click } = await setup(BUNDLE_ID);

    await click(page.querySelector('.recipe-page__log-button'));
    http
      .expectOne({ method: 'POST', url: `${COLLECTION_URL}/log` })
      .flush(null, { status: 400, statusText: 'Bad Request' });
    await click(null);

    expect(text('app-ui-form-error')).toBe('Samlingen blev ikke logget. Prøv igen.');
    expect(TestBed.inject(FoodLogService).entries()).toEqual([]);
    expect(TestBed.inject(Router).url).not.toBe(APP_PATH.FOOD);
  });

  it('shows a spinner while the collections load instead of "not found"', async () => {
    TestBed.inject(CollectionsService).load().subscribe();
    const { page, settle } = await setup(BUNDLE_ID);

    expect(page.querySelector('app-ui-spinner')).not.toBeNull();

    http
      .expectOne('/api/v1/me/meal-collections?limit=100')
      .flush({ items: [MEAL_PREP], nextCursor: null, hasMore: false });
    await settle();

    expect(normalize(page.querySelector('.recipe-page__title')?.textContent)).toBe('Meal prep');
  });

  it('shows the load error instead of 0 kcal when the foods failed to load', async () => {
    flushTestCollections([MEAL_PREP]);
    TestBed.inject(FoodLogService).load().subscribe();
    http.expectOne('/api/v1/foods?limit=100').flush(null, { status: 503, statusText: 'Error' });
    http.expectOne((request) => request.url === '/api/v1/me/food-logs');
    const { page, text } = await setup(BUNDLE_ID);

    expect(text('app-ui-empty-state')).toBe('Vi kunne ikke hente dine samlinger.');
    expect(page.querySelector('.recipe-page__log-button')).toBeNull();
    expect(page.querySelector('[aria-label="Rediger samling"]')).toBeNull();
  });

  it('shows an empty state and a way back when the id is unknown', async () => {
    const { page, text, button, click } = await setup('findes-ikke');

    expect(text('app-ui-empty-state')).toBe('Vi kunne ikke finde den her samling.');
    expect(page.querySelector('[aria-label="Rediger samling"]')).toBeNull();
    expect(button('Slet samling')).toBeUndefined();

    await click(button('Tilbage til samlinger'));

    expect(TestBed.inject(Router).url).toBe(APP_PATH.COLLECTIONS);
  });

  describe('editing and deleting', () => {
    beforeEach(() => loadMealPrep());

    async function rename(setupResult: Awaited<ReturnType<typeof setup>>, name: string) {
      const { page, settle, click, button } = setupResult;
      await click(page.querySelector('[aria-label="Rediger samling"]'));
      const input = page.querySelector<HTMLInputElement>('.new-collection-sheet__name input');
      expect(input?.value).toBe('Meal prep');
      if (input) {
        input.value = name;
        input.dispatchEvent(new Event('input'));
      }
      await settle();
      await click(button('Gem ændringer'));
    }

    it('saves the edited collection and closes the sheet', async () => {
      const result = await setup(BUNDLE_ID);

      await rename(result, 'Frokostboks');
      const patch = http.expectOne({ method: 'PATCH', url: COLLECTION_URL });
      expect(patch.request.body).toEqual({ name: 'Frokostboks' });
      patch.flush({ ...MEAL_PREP, name: 'Frokostboks' });
      http
        .expectOne({ method: 'GET', url: COLLECTION_URL })
        .flush({ ...MEAL_PREP, name: 'Frokostboks' });
      await result.settle();

      expect(result.text('.recipe-page__title')).toBe('Frokostboks');
      expect(result.page.querySelector('[role="dialog"]')).toBeNull();
    });

    it('closes the sheet and shows the error after a failed edit', async () => {
      const result = await setup(BUNDLE_ID);

      await rename(result, 'Frokostboks');
      http
        .expectOne({ method: 'PATCH', url: COLLECTION_URL })
        .flush(null, { status: 503, statusText: 'Unavailable' });
      http.expectOne({ method: 'GET', url: COLLECTION_URL }).flush(MEAL_PREP);
      await result.settle();

      expect(result.page.querySelector('[role="dialog"]')).toBeNull();
      expect(result.text('.recipe-page__title')).toBe('Meal prep');
      expect(result.text('app-ui-form-error')).toBe(
        'Serveren svarer ikke lige nu. Prøv igen om lidt.',
      );
    });

    it('keeps the collection when the deletion is cancelled', async () => {
      const { button, click, text } = await setup(BUNDLE_ID);

      await click(button('Slet samling'));
      // Only the collection goes – its foods and the rows already logged from it stay.
      expect(text('.ui-confirm-sheet__body')).toBe(
        '«Meal prep» bliver slettet. Varerne og det, du allerede har logget, bliver stående. Det kan ikke fortrydes.',
      );
      await click(button('Annuller'));

      expect(TestBed.inject(CollectionsService).collections()).toHaveLength(1);
      expect(TestBed.inject(Router).url).not.toBe(APP_PATH.COLLECTIONS);
    });

    it('deletes the collection after confirmation and returns to the list', async () => {
      const { button, click, settle } = await setup(BUNDLE_ID);

      await click(button('Slet samling'));
      await click(button('Ja, slet samlingen'));
      http.expectOne({ method: 'DELETE', url: COLLECTION_URL }).flush(null);
      await settle();

      expect(TestBed.inject(CollectionsService).collections()).toEqual([]);
      expect(TestBed.inject(Router).url).toBe(APP_PATH.COLLECTIONS);
    });

    it('stays with a message when the deletion fails', async () => {
      const { page, text, button, click, settle } = await setup(BUNDLE_ID);

      await click(button('Slet samling'));
      await click(button('Ja, slet samlingen'));
      http.expectOne({ method: 'DELETE', url: COLLECTION_URL }).error(new ProgressEvent('error'));
      await settle();

      expect(page.querySelector('[role="dialog"]')).toBeNull();
      expect(text('app-ui-form-error')).toBe('Ingen forbindelse. Tjek dit internet, og prøv igen.');
      expect(TestBed.inject(CollectionsService).collections()).toHaveLength(1);
    });
  });
});
