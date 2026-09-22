import { Component, Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FoodCollection, FoodItem, LoggedFood } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { CollectionsService } from '../../../../core/services/collections';
import { FoodLogService } from '../../../../core/services/food-log';
import { TEST_NOW, provideComponentTestEnvironment } from '../../../../core/testing/test-providers';
import { FoodPickerStartStep } from '../../../../shared/components/food-picker/food-picker';
import { FoodAddSheet } from './food-add-sheet';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`,
 * a frozen `NOW` and 0ms mock delays. The browser's storage is cleared per test.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

const LOGGED_SALAD: LoggedFood = {
  id: 'food-salat',
  logId: 'log-1',
  meal: 'frokost',
  loggedAt: TEST_NOW.toISOString(),
  name: 'Kyllingesalat',
  quantity: '250 g',
  kcal: 380,
  protein: 30,
  carbs: 20,
  fat: 10,
};

/** Stub without collections, so the empty state can be shown. */
const NO_COLLECTIONS: Pick<CollectionsService, 'collections' | 'collectionTotals' | 'recipeById'> =
  {
    collections: signal<readonly FoodCollection[]>([]),
    collectionTotals: () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 }),
    recipeById: () => undefined,
  };

@Component({
  imports: [FoodAddSheet],
  template: `
    <app-food-add-sheet
      [open]="open()"
      [(meal)]="meal"
      [editEntry]="editEntry()"
      [startStep]="startStep()"
      (closed)="closes = closes + 1"
      (selected)="selected.push($event)"
      (scanRequested)="scans = scans + 1"
    />
  `,
})
class Host {
  readonly open = signal(true);
  readonly meal = signal<MealId>('morgen');
  readonly editEntry = signal<LoggedFood | null>(null);
  readonly startStep = signal<FoodPickerStartStep>('search');
  readonly selected: FoodItem[] = [];
  closes = 0;
  scans = 0;
}

interface Setup {
  fixture: ComponentFixture<Host>;
  host: Host;
  root: HTMLElement;
  settle: () => Promise<void>;
  text: (selector: string) => string;
  texts: (selector: string) => string[];
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('FoodAddSheet', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function setup(
    configure?: (host: Host) => void,
    providers: Provider[] = [],
    prepare?: () => void,
  ): Promise<Setup> {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [...TEST_PROVIDERS, ...providers],
    });
    prepare?.();
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    configure?.(host);
    const root = fixture.nativeElement as HTMLElement;

    const settle = async (): Promise<void> => {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await fixture.whenStable();
    };

    await settle();
    return {
      fixture,
      host,
      root,
      settle,
      text: (selector) => normalize(root.querySelector(selector)?.textContent),
      texts: (selector) =>
        Array.from(root.querySelectorAll(selector)).map((node) => normalize(node.textContent)),
    };
  }

  it('titles itself after the chosen meal and shows the chips and tabs', async () => {
    const { root, text, texts } = await setup();

    expect(text('.ui-sheet__title')).toBe('Tilføj morgenmad');
    expect(texts('.food-add-sheet__meals button')).toEqual([
      'Morgenmad',
      'Frokost',
      'Aftensmad',
      'Snacks',
    ]);
    expect(root.querySelector('app-ui-segmented-control')).not.toBeNull();
  });

  it('retitles itself when another meal chip is picked', async () => {
    const { host, root, settle, text } = await setup();

    const chips = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.food-add-sheet__meals button'),
    );
    chips[2]?.click();
    await settle();

    expect(host.meal()).toBe('aften');
    expect(text('.ui-sheet__title')).toBe('Tilføj aftensmad');
  });

  it('hides the chips and tabs while a logged item is edited', async () => {
    const { root, text } = await setup((host) => host.editEntry.set(LOGGED_SALAD));

    expect(text('.ui-sheet__title')).toBe('Rediger vare');
    expect(root.querySelector('.food-add-sheet__meals')).toBeNull();
    expect(root.querySelector('app-ui-segmented-control')).toBeNull();
    expect(text('.food-picker__title')).toBe('Kyllingesalat');
  });

  it('lists the collections that have content and logs one as a single item', async () => {
    // The app has no fixed collections – the user has to have created one themselves.
    const { host, root, settle } = await setup(undefined, [], () => {
      TestBed.inject(CollectionsService).create({
        name: 'Meal prep',
        icon: 'bag',
        meal: 'frokost',
        items: [
          { ...LOGGED_SALAD, id: 'item-salat' },
          { ...LOGGED_SALAD, id: 'item-salat-2' },
        ],
      });
    });
    const collections = TestBed.inject(CollectionsService);
    const first = collections.collections()[0];

    root.querySelectorAll<HTMLButtonElement>('.ui-segmented-control__option')[1]?.click();
    await settle();

    const rows = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.food-add-sheet__collection'),
    );
    expect(rows).toHaveLength(collections.collections().length);

    rows[0]?.click();
    await settle();

    const totals = first ? collections.collectionTotals(first) : null;
    expect(host.selected[0]).toEqual({
      id: first?.id,
      name: first?.name,
      quantity: `${totals?.count} varer`,
      kcal: totals?.kcal,
      protein: totals?.protein,
      carbs: totals?.carbs,
      fat: totals?.fat,
    });
  });

  it('explains how to build a collection when there are none', async () => {
    const { root, settle, text } = await setup(undefined, [
      { provide: CollectionsService, useValue: NO_COLLECTIONS },
    ]);

    root.querySelectorAll<HTMLButtonElement>('.ui-segmented-control__option')[1]?.click();
    await settle();

    expect(text('app-ui-empty-state')).toBe(
      'Du har ingen samlinger med varer endnu. Byg en under Samling, så kan du logge den her med ét tryk.',
    );
  });

  it('hides the chips when the scanner sends an open sheet to "Ny egen vare"', async () => {
    const { host, root, settle, text } = await setup();
    expect(root.querySelector('.food-add-sheet__meals')).not.toBeNull();

    host.startStep.set('new-food');
    await settle();

    expect(root.querySelector('.food-add-sheet__meals')).toBeNull();
    expect(text('.food-picker__title')).toBe('Ny egen vare');
  });

  it('keeps the meal chips but drops the tabs on the portion step', async () => {
    // Search only finds the user's own foods, so there has to be one to select.
    const { root, settle } = await setup(undefined, [], () => {
      TestBed.inject(FoodLogService).addCustomFood({
        name: 'Havregryn',
        quantity: '60 g',
        kcal: 222,
        protein: 8,
        carbs: 38,
        fat: 4,
      });
    });

    root.querySelector<HTMLButtonElement>('.food-picker__result')?.click();
    await settle();

    expect(root.querySelector('.food-picker__step--portion')).not.toBeNull();
    expect(root.querySelector('.food-add-sheet__meals')).not.toBeNull();
    expect(root.querySelector('app-ui-segmented-control')).toBeNull();
  });

  it('starts over on the Varer tab every time it opens', async () => {
    const { host, root, settle } = await setup();

    root.querySelectorAll<HTMLButtonElement>('.ui-segmented-control__option')[1]?.click();
    await settle();
    expect(root.querySelector('app-food-picker')).toBeNull();

    host.open.set(false);
    await settle();
    host.open.set(true);
    await settle();

    expect(root.querySelector('app-food-picker')).not.toBeNull();
  });
});
