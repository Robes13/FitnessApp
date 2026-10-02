import { HttpTestingController } from '@angular/common/http/testing';
import { Component, EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { CollectionsService } from '../../../../core/services/collections/collections';
import {
  flushTestCollections,
  flushTestFoodLog,
  testCollection,
  testFood,
} from '../../../../core/testing/fixtures';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';
import { COLLECTIONS_ROUTES } from '../../collections.routes';
import { NewCollectionSheet } from '../../components/new-collection-sheet/new-collection-sheet';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  { path: APP_ROUTE.FOOD, component: Blank },
  { path: APP_ROUTE.COLLECTIONS, children: COLLECTIONS_ROUTES },
];

/** The page must render in the real jsdom DOM, so only time is overridden. */
const TEST_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideRouter(ROUTES, withComponentInputBinding()),
  ...provideComponentTestEnvironment(),
];

const COLLECTIONS_URL = '/api/v1/me/meal-collections';
const MEAL_PREP = testCollection(3, 'Meal prep', [
  { foodId: 1, foodName: 'Tunsalat', quantity: 200, unit: 'Gram' },
]);

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('CollectionsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function setup() {
    const harness = await RouterTestingHarness.create(APP_PATH.COLLECTIONS);
    const page = harness.routeNativeElement as HTMLElement;
    const text = (selector: string) => normalize(page.querySelector(selector)?.textContent);
    const texts = (selector: string) =>
      Array.from(page.querySelectorAll<HTMLElement>(selector)).map((el) =>
        normalize(el.textContent),
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
    return { harness, page, text, texts, settle, click };
  }

  it('renders the title and explains how to start without collections', async () => {
    const { text, texts } = await setup();

    expect(text('.collections-page__title')).toBe('Samlinger');
    // Collections only – no dishes or loose items (P13).
    expect(text('.collections-page__subtitle')).toBe(
      'Saml de varer, du tit spiser sammen, og log dem samlet som spist.',
    );
    expect(texts('.collections-page__card-title')).toEqual([]);
    expect(text('app-ui-empty-state')).toBe(
      'Du har ingen samlinger endnu. Tryk på + for at samle de varer, du tit spiser sammen.',
    );
  });

  it('shows a collection as one bundle row and opens it on tap', async () => {
    flushTestFoodLog([testFood({ foodId: 1, name: 'Tunsalat', caloriesPer100: 120 })]);
    flushTestCollections([MEAL_PREP]);
    const { page, texts, click } = await setup();

    expect(texts('.collections-page__card-title')).toEqual(['Meal prep']);
    expect(texts('.collections-page__meta')).toEqual(['1 vare']);
    expect(texts('.collections-page__macros')).toEqual(['240 kcal · 0 g protein']);

    await click(page.querySelector('.collections-page__card'));

    expect(TestBed.inject(Router).url).toBe(APP_PATH.recipe('col:3'));
  });

  it('shows a spinner while loading and a retry after a failed load', async () => {
    TestBed.inject(CollectionsService).load().subscribe();
    const { page, text, settle, click } = await setup();
    // Creating waits for the list: the name check needs it, and a load would overwrite the new one.
    const create = () =>
      page.querySelector<HTMLButtonElement>('button[aria-label="Opret samling"]');

    expect(page.querySelector('app-ui-spinner')).not.toBeNull();
    expect(create()?.disabled).toBe(true);

    http
      .expectOne(`${COLLECTIONS_URL}?limit=100`)
      .flush(null, { status: 503, statusText: 'Unavailable' });
    await settle();

    expect(text('app-ui-empty-state')).toBe('Vi kunne ikke hente dine samlinger.');
    expect(create()?.disabled).toBe(true);

    await click(page.querySelector('.collections-page__status button'));
    http
      .expectOne(`${COLLECTIONS_URL}?limit=100`)
      .flush({ items: [MEAL_PREP], nextCursor: null, hasMore: false });
    await settle();

    expect(page.querySelector('.collections-page__card')).not.toBeNull();
    expect(create()?.disabled).toBe(false);
  });

  it('opens the new-collection sheet from the plus button', async () => {
    const { page, click } = await setup();

    expect(page.querySelector('[role="dialog"]')).toBeNull();
    await click(page.querySelector('button[aria-label="Opret samling"]'));

    expect(page.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Ny samling');
  });

  it('closes the sheet only once the API has created the collection', async () => {
    flushTestFoodLog([testFood({ foodId: 1, name: 'Tunsalat', caloriesPer100: 120 })]);
    const { harness, page, text, settle, click } = await setup();
    await click(page.querySelector('button[aria-label="Opret samling"]'));
    const sheet = harness.fixture.debugElement.query(By.directive(NewCollectionSheet));
    const input = {
      name: 'Meal prep',
      items: [
        { id: '1', name: 'Tunsalat', quantity: '200 g', kcal: 240, protein: 0, carbs: 0, fat: 0 },
      ],
    };

    sheet.triggerEventHandler('created', input);
    http
      .expectOne({ method: 'POST', url: COLLECTIONS_URL })
      .flush(null, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(page.querySelector('[role="dialog"]')).not.toBeNull();
    expect(text('.new-collection-sheet__save-error')).toBe('Samlingen blev ikke gemt. Prøv igen.');

    sheet.triggerEventHandler('created', input);
    http.expectOne({ method: 'POST', url: COLLECTIONS_URL }).flush(MEAL_PREP);
    await settle();

    expect(page.querySelector('[role="dialog"]')).toBeNull();
    expect(
      TestBed.inject(CollectionsService)
        .collections()
        .map((c) => c.name),
    ).toEqual(['Meal prep']);
  });
});
