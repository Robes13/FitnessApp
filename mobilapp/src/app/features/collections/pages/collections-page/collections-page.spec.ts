import { Component, EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { COLLECTIONS_ROUTES } from '../../collections.routes';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  { path: APP_ROUTE.FOOD, component: Blank },
  { path: APP_ROUTE.COLLECTIONS, children: COLLECTIONS_ROUTES },
];

/** The page must render in the real jsdom DOM, so only time and mock delays are overridden. */
const TEST_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideRouter(ROUTES, withComponentInputBinding()),
  ...provideComponentTestEnvironment(),
];

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('CollectionsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  async function setup() {
    const harness = await RouterTestingHarness.create(APP_PATH.COLLECTIONS);
    const page = harness.routeNativeElement as HTMLElement;
    const texts = (selector: string) =>
      Array.from(page.querySelectorAll<HTMLElement>(selector)).map((el) =>
        normalize(el.textContent),
      );
    const click = async (element: Element | undefined | null) => {
      (element as HTMLElement | null)?.click();
      await harness.fixture.whenStable();
    };
    return { harness, page, texts, click };
  }

  it('renders the title and an empty list until the user creates something', async () => {
    const { page, texts } = await setup();

    expect(normalize(page.querySelector('.collections-page__title')?.textContent)).toBe(
      'Samlinger',
    );
    expect(normalize(page.querySelector('.collections-page__subtitle')?.textContent)).toBe(
      'Dine varer og retter – log dem direkte som spist.',
    );
    // Dishes and fixed collections must come from the backend, so only "All" remains.
    expect(texts('.collections-page__chip')).toEqual(['Alle']);
    expect(texts('.collections-page__card-title')).toEqual([]);
  });

  it('opens a user collection when its card is tapped', async () => {
    const created = TestBed.inject(CollectionsService).create({
      name: 'Meal prep',
      icon: 'bag',
      meal: 'frokost',
      items: [],
    });
    const { page, click } = await setup();

    await click(page.querySelector('.collections-page__card'));

    expect(TestBed.inject(Router).url).toBe(APP_PATH.recipe(`col:${created.id}`));
  });

  it('shows a user collection as one bundle row', async () => {
    TestBed.inject(CollectionsService).create({
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
    const { texts } = await setup();

    expect(texts('.collections-page__card-title')[0]).toBe('Meal prep');
    expect(texts('.collections-page__meta')[0]).toBe('1 vare');
  });

  it('opens the new-collection sheet from the plus button', async () => {
    const { page, click } = await setup();

    expect(page.querySelector('[role="dialog"]')).toBeNull();
    await click(page.querySelector('button[aria-label="Opret samling"]'));

    expect(page.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Ny samling');
  });
});
