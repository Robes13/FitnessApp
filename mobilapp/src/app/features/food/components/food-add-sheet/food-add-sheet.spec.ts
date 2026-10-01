import { Component, Provider, signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FoodItem, LoggedFood } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import {
  TEST_FOOD,
  flushTestCollections,
  flushTestFoodLog,
  testCollection,
  testFood,
  testFoodLog,
} from '../../../../core/testing/fixtures';
import { TEST_NOW, provideComponentTestEnvironment } from '../../../../core/testing/test-providers';
import { FoodPickerStartStep } from '../../../../shared/components/food-picker/food-picker';
import { FoodAddSheet } from './food-add-sheet';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT` and a
 * frozen `NOW`. The browser's storage is cleared per test.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];
const COLLECTIONS_URL = '/api/v1/me/meal-collections?limit=100';

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

@Component({
  imports: [FoodAddSheet],
  template: `
    <app-food-add-sheet
      [open]="open()"
      [(meal)]="meal"
      [editEntry]="editEntry()"
      [startStep]="startStep()"
      [busy]="busy()"
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
  readonly busy = signal(false);
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

  afterEach(() => TestBed.inject(HttpTestingController).verify());

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

  describe('the Samlinger tab', () => {
    const LOG_URL = '/api/v1/me/meal-collections/3/log';

    async function openTab(): Promise<Setup> {
      const result = await setup(undefined, [], () => {
        flushTestFoodLog([
          testFood({
            foodId: 1,
            name: 'Havregryn',
            caloriesPer100: 370,
            proteinPer100: 13,
            carbohydratesPer100: 60,
            fatPer100: 7,
          }),
        ]);
        flushTestCollections([
          testCollection(3, 'Meal prep', [
            { foodId: 1, foodName: 'Havregryn', quantity: 60, unit: 'Gram' },
            { foodId: 1, foodName: 'Havregryn', quantity: 40, unit: 'Gram' },
          ]),
        ]);
      });
      result.root.querySelectorAll<HTMLButtonElement>('.ui-segmented-control__option')[1]?.click();
      await result.settle();
      return result;
    }

    function row(root: HTMLElement): HTMLButtonElement | null {
      return root.querySelector<HTMLButtonElement>('.food-add-sheet__collection');
    }

    function logButton(root: HTMLElement): HTMLButtonElement | null {
      return root.querySelector<HTMLButtonElement>('.food-add-sheet__confirm-log');
    }

    /** Spec 3.2: a tap only chooses the collection – nothing is logged before the confirmation. */
    async function choose({ root, settle }: Setup): Promise<void> {
      row(root)?.click();
      await settle();
      TestBed.inject(HttpTestingController).expectNone({ method: 'POST', url: LOG_URL });
    }

    it('lists the collections with their items and rounded kcal', async () => {
      const { texts } = await openTab();

      expect(texts('.food-add-sheet__collection-name')).toEqual(['Meal prep']);
      expect(texts('.food-add-sheet__collection-sub')).toEqual(['Havregryn, Havregryn']);
      expect(texts('.food-add-sheet__collection-end')).toEqual(['370 kcal']);
    });

    it('shows the chosen collection with its nutrition before anything is logged', async () => {
      const sheet = await openTab();
      await choose(sheet);

      expect(sheet.root.querySelector('.food-add-sheet__collections')).toBeNull();
      expect(sheet.text('.food-add-sheet__confirm .food-add-sheet__collection-name')).toBe(
        'Meal prep',
      );
      expect(sheet.text('.food-add-sheet__confirm-totals')).toBe(
        '370 kcal · 13 g protein · 60 g kulhydrat · 7 g fedt',
      );
      expect(sheet.text('.food-add-sheet__confirm-log')).toBe('Log 370 kcal under morgenmad');
    });

    it('goes back to the list without logging on "Fortryd"', async () => {
      const sheet = await openTab();
      await choose(sheet);

      sheet.root.querySelector<HTMLButtonElement>('.food-add-sheet__confirm-cancel')?.click();
      await sheet.settle();

      expect(sheet.texts('.food-add-sheet__collection-name')).toEqual(['Meal prep']);
      expect(sheet.host.closes).toBe(0);
    });

    it('logs a collection under the chosen meal in one call and then closes', async () => {
      const sheet = await openTab();
      const { host, root, settle } = sheet;
      const http = TestBed.inject(HttpTestingController);
      await choose(sheet);

      logButton(root)?.click();
      await settle();
      // The button is busy while the log runs, so a second tap sends nothing.
      expect(logButton(root)?.getAttribute('aria-busy')).toBe('true');
      logButton(root)?.click();
      const request = http.expectOne({ method: 'POST', url: LOG_URL });
      expect(request.request.body).toMatchObject({ mealType: 'Breakfast', multiplier: 1 });
      request.flush([
        testFoodLog({ ...TEST_FOOD, name: 'Havregryn', quantity: '60 g' }, 'morgen'),
        testFoodLog({ ...TEST_FOOD, name: 'Havregryn', quantity: '40 g' }, 'morgen'),
      ]);
      await settle();

      expect(host.closes).toBe(1);
      expect(host.selected).toEqual([]);
      expect(TestBed.inject(FoodLogService).byMeal().get('morgen')).toHaveLength(2);
    });

    it('stays open with a message when the log fails', async () => {
      const sheet = await openTab();
      const { host, root, settle, text } = sheet;
      await choose(sheet);

      logButton(root)?.click();
      TestBed.inject(HttpTestingController)
        .expectOne({ method: 'POST', url: LOG_URL })
        .flush(null, { status: 400, statusText: 'Bad Request' });
      await settle();

      expect(host.closes).toBe(0);
      expect(text('.food-add-sheet__error')).toBe('Samlingen blev ikke logget. Prøv igen.');
      expect(logButton(root)?.getAttribute('aria-busy')).toBeNull();
    });

    it('turns the rows off while the page saves', async () => {
      const { host, root, settle } = await openTab();

      host.busy.set(true);
      await settle();

      expect(row(root)?.disabled).toBe(true);
      expect(row(root)?.getAttribute('aria-busy')).toBe('true');
    });
  });

  it('shows a failed collections load with a retry, not "no collections"', async () => {
    const { root, settle, text } = await setup(undefined, [], () => {
      TestBed.inject(CollectionsService).load().subscribe();
      TestBed.inject(HttpTestingController)
        .expectOne(COLLECTIONS_URL)
        .flush(null, { status: 503, statusText: 'Unavailable' });
    });

    root.querySelectorAll<HTMLButtonElement>('.ui-segmented-control__option')[1]?.click();
    await settle();

    expect(text('app-ui-empty-state')).toBe('Vi kunne ikke hente dine samlinger.');

    root.querySelector<HTMLButtonElement>('.food-add-sheet__status button')?.click();
    await settle();
    expect(root.querySelector('app-ui-spinner')).not.toBeNull();
    TestBed.inject(HttpTestingController)
      .expectOne(COLLECTIONS_URL)
      .flush({ items: [testCollection(3, 'Meal prep', [])], nextCursor: null, hasMore: false });
    await settle();

    expect(text('.food-add-sheet__collection-name')).toBe('Meal prep');
  });

  it('explains how to build a collection when there are none', async () => {
    const { root, settle, text } = await setup();

    root.querySelectorAll<HTMLButtonElement>('.ui-segmented-control__option')[1]?.click();
    await settle();

    expect(text('app-ui-empty-state')).toBe(
      'Du har ingen samlinger med varer endnu. Byg en under Samling, så kan du logge den her.',
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
      flushTestFoodLog([testFood({ foodId: 1, name: 'Havregryn', caloriesPer100: 370 })]);
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
