import { Component, EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { CollectionsService } from '../../../../core/services/collections';
import { COLLECTIONS_ROUTES } from '../../collections.routes';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  { path: APP_ROUTE.FOOD, component: Blank },
  { path: APP_ROUTE.COLLECTIONS, children: COLLECTIONS_ROUTES },
];

/** Siden skal tegnes i den rigtige jsdom-DOM, så kun tid og mock-forsinkelser overstyres. */
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

  it('renders the title, the filter chips and every recipe', async () => {
    const { page, texts } = await setup();

    expect(normalize(page.querySelector('.collections-page__title')?.textContent)).toBe(
      'Samlinger',
    );
    expect(normalize(page.querySelector('.collections-page__subtitle')?.textContent)).toBe(
      'Dine varer og retter – log dem direkte som spist.',
    );
    expect(texts('.collections-page__chip')).toEqual([
      'Alle',
      'Morgenmad',
      'Frokost',
      'Aftensmad',
      'Snacks',
    ]);
    expect(texts('.collections-page__card-title')).toHaveLength(8);
  });

  it('filters the list when a chip is picked', async () => {
    const { page, texts, click } = await setup();
    const chips = page.querySelectorAll<HTMLButtonElement>('.collections-page__chip');

    await click(chips[2]);

    expect(texts('.collections-page__card-title')).toEqual([
      'Kyllingesalat med kikærter',
      'Tunwrap med rødkål',
    ]);
  });

  it('opens the recipe screen when a card is tapped', async () => {
    const { page, click } = await setup();

    await click(page.querySelector('.collections-page__card'));

    expect(TestBed.inject(Router).url).toBe(APP_PATH.recipe('skyr'));
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
    expect(texts('.collections-page__meta')[0]).toBe('Frokost · 1 vare');
  });

  it('opens the new-collection sheet from the plus button', async () => {
    const { page, click } = await setup();

    expect(page.querySelector('[role="dialog"]')).toBeNull();
    await click(page.querySelector('button[aria-label="Opret samling"]'));

    expect(page.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Ny samling');
  });
});
