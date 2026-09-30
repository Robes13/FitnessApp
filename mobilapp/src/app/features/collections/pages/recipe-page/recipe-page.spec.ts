import { Component, EnvironmentProviders, Provider } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import { COLLECTIONS_ROUTES } from '../../collections.routes';
import { BUNDLE_ID_PREFIX } from '../../services/collections-view';
import { flushTestFoodLog, testFood } from '../../../../core/testing/fixtures';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  { path: APP_ROUTE.FOOD, component: Blank },
  { path: APP_ROUTE.COLLECTIONS, children: COLLECTIONS_ROUTES },
];

const TEST_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideRouter(ROUTES, withComponentInputBinding()),
  ...provideComponentTestEnvironment(),
];

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('RecipePage', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function setup(recipeId: string) {
    const harness = await RouterTestingHarness.create(APP_PATH.recipe(recipeId));
    const page = harness.routeNativeElement as HTMLElement;
    const texts = (selector: string) =>
      Array.from(page.querySelectorAll<HTMLElement>(selector)).map((el) =>
        normalize(el.textContent),
      );
    const button = (label: string) =>
      Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
        (el) => normalize(el.textContent) === label,
      );
    const click = async (element: Element | undefined | null) => {
      (element as HTMLElement | null)?.click();
      await harness.fixture.whenStable();
    };
    return { harness, page, texts, button, click };
  }

  /** A collection with one food – the app has no dishes until the backend provides them. */
  function createBundle(): string {
    const created = TestBed.inject(CollectionsService).create({
      name: 'Meal prep',
      icon: 'bag',
      meal: 'frokost',
      items: [
        {
          id: 'item-tun',
          name: 'Tunsalat',
          quantity: '200 g',
          kcal: 240,
          protein: 28,
          carbs: 6,
          fat: 11,
        },
      ],
    });
    return `${BUNDLE_ID_PREFIX}${created.id}`;
  }

  it('shows the macros of a bundle', async () => {
    const { texts } = await setup(createBundle());

    expect(texts('.recipe-page__stat-label')).toEqual(['Kalorier', 'Protein', 'Kulhydrat', 'Fedt']);
    expect(texts('.recipe-page__stat-value')).toEqual(['240', '28 g', '6 g', '11 g']);
  });

  it('logs each item of the bundle under the chosen meal and switches to Mad', async () => {
    // The item is the catalogue food of the same name (the collection keeps its own item id).
    flushTestFoodLog([testFood({ foodId: 5, name: 'Tunsalat', caloriesPer100: 120 })]);
    const { page, button, click } = await setup(createBundle());

    await click(button('Aftensmad'));
    await click(page.querySelector('.recipe-page__log-button'));
    await click(page.querySelector('.recipe-page__log-button'));
    const log = TestBed.inject(HttpTestingController).expectOne({
      method: 'POST',
      url: '/api/v1/me/food-logs',
    });
    expect(log.request.body).toMatchObject({
      foodId: 5,
      quantity: 200,
      unit: 'Gram',
      mealType: 'Dinner',
    });
    log.flush({
      ...log.request.body,
      foodLogId: 1,
      foodName: 'Tunsalat',
      caloriesConsumed: 240,
      proteinConsumed: 28,
      carbohydratesConsumed: 6,
      fatConsumed: 11,
    });
    await click(null);

    const logged = TestBed.inject(FoodLogService)
      .entries()
      .find((entry) => entry.name === 'Tunsalat');
    expect(logged).toMatchObject({ meal: 'aften', kcal: 240 });
    expect(TestBed.inject(Router).url).toBe(APP_PATH.FOOD);
  });

  it('stays on the page with a message when the log fails', async () => {
    flushTestFoodLog([testFood({ foodId: 5, name: 'Tunsalat' })]);
    const { page, click } = await setup(createBundle());

    await click(page.querySelector('.recipe-page__log-button'));
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/api/v1/me/food-logs' })
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await click(null);

    expect(normalize(page.querySelector('app-ui-form-error')?.textContent)).toBe(
      'Serveren svarer ikke lige nu. Prøv igen om lidt.',
    );
    expect(TestBed.inject(FoodLogService).entries()).toEqual([]);
    expect(TestBed.inject(Router).url).not.toBe(APP_PATH.FOOD);
  });

  it('opens a user collection as a bundle', async () => {
    const created = TestBed.inject(CollectionsService).create({
      name: 'Meal prep',
      icon: 'bag',
      meal: 'frokost',
      items: [
        {
          id: 'item-tun',
          name: 'Tunsalat',
          quantity: '200 g',
          kcal: 240,
          protein: 28,
          carbs: 6,
          fat: 11,
        },
      ],
    });

    const { page, texts } = await setup(`${BUNDLE_ID_PREFIX}${created.id}`);

    expect(normalize(page.querySelector('.recipe-page__title')?.textContent)).toBe('Meal prep');
    expect(texts('.recipe-page__line')).toHaveLength(1);
    expect(
      normalize(page.querySelector('.recipe-page__line')?.firstElementChild?.textContent),
    ).toBe('Tunsalat');
    expect(texts('.recipe-page__line-qty')).toEqual(['200 g']);
    expect(normalize(page.querySelector('.recipe-page__log-button')?.textContent)).toBe(
      'Log 240 kcal',
    );
  });

  it('shows an empty state and a way back when the id is unknown', async () => {
    const { page, button, click } = await setup('findes-ikke');

    expect(normalize(page.querySelector('app-ui-empty-state')?.textContent)).toBe(
      'Vi kunne ikke finde den her opskrift.',
    );

    await click(button('Tilbage til samlinger'));

    expect(TestBed.inject(Router).url).toBe(APP_PATH.COLLECTIONS);
  });

  describe('editing and deleting a user collection', () => {
    async function settle(harness: RouterTestingHarness): Promise<void> {
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await harness.fixture.whenStable();
    }

    it('offers no edit or delete on an unknown id', async () => {
      const { page, button } = await setup('findes-ikke');

      expect(page.querySelector('[aria-label="Rediger samling"]')).toBeNull();
      expect(button('Slet samling')).toBeUndefined();
    });

    it('saves the edited collection from the prefilled sheet', async () => {
      const { harness, page, button, click } = await setup(createBundle());

      await click(page.querySelector('[aria-label="Rediger samling"]'));
      await settle(harness);
      const input = page.querySelector<HTMLInputElement>('.new-collection-sheet__name input');
      expect(input?.value).toBe('Meal prep');

      if (input) {
        input.value = 'Frokostboks';
        input.dispatchEvent(new Event('input'));
      }
      await settle(harness);
      await click(button('Gem ændringer'));
      await settle(harness);

      expect(TestBed.inject(CollectionsService).userCollections()[0]?.name).toBe('Frokostboks');
      expect(normalize(page.querySelector('.recipe-page__title')?.textContent)).toBe('Frokostboks');
    });

    it('keeps the collection when the deletion is cancelled', async () => {
      const { harness, button, click } = await setup(createBundle());

      await click(button('Slet samling'));
      await settle(harness);
      await click(button('Annuller'));

      expect(TestBed.inject(CollectionsService).userCollections()).toHaveLength(1);
      expect(TestBed.inject(Router).url).not.toBe(APP_PATH.COLLECTIONS);
    });

    it('deletes the collection after confirmation and returns to the list', async () => {
      const { harness, button, click } = await setup(createBundle());

      await click(button('Slet samling'));
      await settle(harness);
      await click(button('Ja, slet samlingen'));
      await settle(harness);

      expect(TestBed.inject(CollectionsService).userCollections()).toEqual([]);
      expect(TestBed.inject(Router).url).toBe(APP_PATH.COLLECTIONS);
    });
  });
});
