import { Component, EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { CollectionsService } from '../../../../core/services/collections';
import { FoodLogService } from '../../../../core/services/food-log';
import { COLLECTIONS_ROUTES } from '../../collections.routes';
import { BUNDLE_ID_PREFIX } from '../../services/collections-view';
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

  it('shows the recipe, its macros and its ingredients', async () => {
    const { page, texts } = await setup('skyr');

    expect(normalize(page.querySelector('.recipe-page__title')?.textContent)).toBe(
      'Skyr-bowl med bær og nødder',
    );
    expect(texts('.recipe-page__stat-label')).toEqual(['Kalorier', 'Protein', 'Kulhydrat', 'Fedt']);
    expect(texts('.recipe-page__stat-value')).toEqual(['380', '32 g', '38 g', '11 g']);
    expect(texts('.recipe-page__line')).toHaveLength(5);
    expect(normalize(page.querySelector('.recipe-page__log-button')?.textContent)).toBe(
      'Log 380 kcal',
    );
  });

  it('logs the recipe under the chosen meal and switches to Mad', async () => {
    const { page, button, click } = await setup('skyr');

    await click(button('Aftensmad'));
    await click(page.querySelector('.recipe-page__log-button'));

    const logged = TestBed.inject(FoodLogService)
      .entries()
      .find((entry) => entry.name === 'Skyr-bowl med bær og nødder');
    expect(logged).toMatchObject({ meal: 'aften', quantity: '1 portion', kcal: 380 });
    expect(TestBed.inject(Router).url).toBe(APP_PATH.FOOD);
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
});
