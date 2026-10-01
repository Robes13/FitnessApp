import { HttpTestingController } from '@angular/common/http/testing';
import { Component, Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FoodCollection, FoodItem, NewCollectionInput } from '../../../../core/models/food';
import { NewCollectionSheet } from './new-collection-sheet';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import {
  flushTestCollections,
  flushTestFoodLog,
  testCollection,
  testFood,
} from '../../../../core/testing/fixtures';
import { FoodPicker } from '../../../../shared/components/food-picker/food-picker';

const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

@Component({
  imports: [NewCollectionSheet],
  template: `
    <app-new-collection-sheet
      [open]="open()"
      [collection]="collection()"
      (created)="created.push($event)"
      (updated)="updated.push($event)"
      (closed)="closes = closes + 1"
    />
  `,
})
class Host {
  readonly open = signal(true);
  readonly collection = signal<FoodCollection | null>(null);
  readonly created: NewCollectionInput[] = [];
  readonly updated: NewCollectionInput[] = [];
  closes = 0;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('NewCollectionSheet', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let root: HTMLElement;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  }

  function buttonByText(label: string): HTMLButtonElement | undefined {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => normalize(button.textContent) === label,
    );
  }

  async function click(element: Element | undefined | null): Promise<void> {
    (element as HTMLElement | null)?.click();
    await settle();
  }

  async function typeName(value: string): Promise<void> {
    const input = root.querySelector<HTMLInputElement>('.new-collection-sheet__name input');
    if (!input) {
      throw new Error('Navnefeltet blev ikke tegnet.');
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [Host], providers: TEST_PROVIDERS });
    // Search only finds the user's own foods – the API has no shared food database.
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
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await settle();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('starts with an empty draft and the design’s hint', () => {
    expect(normalize(root.querySelector('app-ui-empty-state')?.textContent)).toBe(
      'Søg en vare eller scan en stregkode for at fylde samlingen.',
    );
  });

  async function addHavregryn(): Promise<void> {
    await click(buttonByText('Søg vare'));
    await click(root.querySelector('.food-picker__result'));
    await click(root.querySelector('.food-picker__confirm'));
  }

  it('keeps "Opret samling" disabled until the collection has a name and an item', async () => {
    const create = () => buttonByText('Opret samling');

    expect(create()?.disabled).toBe(true);
    expect(normalize(root.querySelector('.new-collection-sheet__min-items')?.textContent)).toBe(
      'Tilføj mindst én vare for at gemme samlingen.',
    );

    await typeName('Meal prep');

    // Spec 4.0-8a: a name alone is not enough.
    expect(create()?.disabled).toBe(true);

    await addHavregryn();

    expect(create()?.disabled).toBe(false);
    expect(root.querySelector('.new-collection-sheet__min-items')).toBeNull();
  });

  it('emits the name and the draft with each food under its own id', async () => {
    await typeName(' Meal prep ');
    await addHavregryn();
    await addHavregryn();
    await click(buttonByText('Opret samling'));

    expect(host.created).toEqual([
      {
        name: 'Meal prep',
        items: [
          expect.objectContaining({ id: '1', name: 'Havregryn', quantity: '100 g' }),
          expect.objectContaining({ id: '1', name: 'Havregryn', quantity: '100 g' }),
        ],
      },
    ]);
  });

  it('shows the draft’s total nutrition as items are added (spec 4.0/4.1)', async () => {
    await addHavregryn();
    await addHavregryn();

    expect(normalize(root.querySelector('.new-collection-sheet__totals')?.textContent)).toBe(
      '740 kcal · 26 g protein · 120 g kulhydrat · 14 g fedt',
    );
  });

  /** The food picker's sheet sits on top of this one (`sheet-high`), so its title comes last. */
  function pickerTitle(): string {
    const titles = Array.from(root.querySelectorAll('.ui-sheet__title'));
    return normalize(titles[titles.length - 1]?.textContent);
  }

  it('calls the picker "Tilføj til samling" and its save-only button "Gem kun under Mine varer"', async () => {
    await click(buttonByText('Søg vare'));
    expect(pickerTitle()).toBe('Tilføj til samling');

    await click(root.querySelector('.food-picker__create'));

    // A collection logs nothing – the custom food is only saved under "Mine varer".
    expect(buttonByText('Gem kun under Mine varer')).toBeDefined();
    expect(buttonByText('Gem uden at logge')).toBeUndefined();
  });

  it('can not be saved while a new custom food is still being saved', async () => {
    await typeName('Meal prep');
    await click(buttonByText('Søg vare'));
    fixture.debugElement.query(By.directive(FoodPicker)).triggerEventHandler('picked', {
      item: {
        id: 'food-new',
        name: 'Mysli',
        quantity: '100 g',
        kcal: 150,
        protein: 5,
        carbs: 0,
        fat: 0,
        isCustom: true,
      },
      amount: 100,
      unit: 'g',
    });
    await settle();

    // Saving now would make `ensureFood` post the same food again (409).
    expect(buttonByText('Opret samling')?.disabled).toBe(true);

    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/api/v1/foods' })
      .flush(testFood({ foodId: 2, name: 'Mysli', caloriesPer100: 150 }));
    await settle();

    expect(buttonByText('Opret samling')?.disabled).toBe(false);
  });

  it('caps the name at the 100 characters the API accepts', () => {
    expect(
      root.querySelector<HTMLInputElement>('.new-collection-sheet__name input')?.maxLength,
    ).toBe(100);
  });

  it('adds a searched food to the draft and removes it again', async () => {
    await click(buttonByText('Søg vare'));
    await click(root.querySelector('.food-picker__result'));
    await click(root.querySelector('.food-picker__confirm'));

    expect(
      Array.from(root.querySelectorAll('.new-collection-sheet__item-name')).map((el) =>
        normalize(el.textContent),
      ),
    ).toEqual(['Havregryn']);

    await click(root.querySelector('.new-collection-sheet__remove'));

    expect(root.querySelector('.new-collection-sheet__item-name')).toBeNull();
    expect(root.querySelector('app-ui-empty-state')).not.toBeNull();
  });

  it('saves a custom food from the picker under "My foods"', async () => {
    await click(buttonByText('Søg vare'));
    const custom: FoodItem = {
      id: 'food-picked',
      name: 'Egen bar',
      quantity: '1 stk',
      kcal: 150,
      protein: 12,
      carbs: 0,
      fat: 0,
      isCustom: true,
    };

    fixture.debugElement
      .query(By.directive(FoodPicker))
      .triggerEventHandler('customFoodCreated', custom);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne({ method: 'POST', url: '/api/v1/foods' })
      .flush(testFood({ foodId: 2, name: 'Egen bar', caloriesPer100: 150 }));
    http
      .expectOne({ method: 'PUT', url: '/api/v1/foods/2/servings/Piece' })
      .flush({ foodServingId: 1, unit: 'Piece', gramsPerUnit: 100 });
    await settle();

    expect(TestBed.inject(FoodLogService).customFoods()[0]).toMatchObject({
      name: 'Egen bar',
      quantity: '1 stk',
    });
  });

  it('still drafts a new food whose name is taken and explains why it was not saved', async () => {
    await click(buttonByText('Søg vare'));
    // Taken in the API (e.g. on another device), not in this catalogue – the picker checks that.
    fixture.debugElement.query(By.directive(FoodPicker)).triggerEventHandler('picked', {
      item: {
        id: 'food-new',
        name: 'Mysli',
        quantity: '1 stk',
        kcal: 150,
        protein: 5,
        carbs: 0,
        fat: 0,
        isCustom: true,
      },
      amount: 1,
      unit: 'stk',
    });
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/api/v1/foods' })
      .flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(TestBed.inject(FoodLogService).customFoods()).toHaveLength(1);
    expect(
      Array.from(root.querySelectorAll('.new-collection-sheet__item-name')).map((el) =>
        normalize(el.textContent),
      ),
    ).toEqual(['Mysli']);
    expect(
      normalize(root.querySelector('.new-collection-sheet__custom-error')?.textContent),
    ).toContain('allerede en egen vare med navnet');
  });

  it('saves a food created after a not-found scan with its barcode (3.1-6a)', async () => {
    const barcode = '5799999999992';
    const http = TestBed.inject(HttpTestingController);
    const typeInto = async (field: HTMLInputElement | null | undefined, value: string) => {
      if (!field) {
        throw new Error('Feltet findes ikke.');
      }
      field.value = value;
      field.dispatchEvent(new Event('input'));
      await settle();
    };

    const lookUp = async (): Promise<void> => {
      await click(buttonByText('Scan'));
      await typeInto(
        root.querySelector<HTMLInputElement>('input[aria-label="Stregkode"]'),
        barcode,
      );
      await click(buttonByText('Slå op'));
    };

    await lookUp();
    http
      .expectOne((request) => request.url.endsWith(`/product/${barcode}.json`))
      .flush({ status: 0 }, { status: 404, statusText: 'Not Found' });
    await settle();
    await click(buttonByText('Opret varen selv'));

    const fields = Array.from(
      root.querySelectorAll<HTMLInputElement>('.food-picker__fields input'),
    );
    await typeInto(fields[0], 'UI Samlingsscan');
    await typeInto(fields[1], '100');
    await typeInto(fields[2], '150');
    await click(buttonByText('Gem kun under Mine varer'));

    const create = http.expectOne({ method: 'POST', url: '/api/v1/foods' });
    expect(create.request.body).toMatchObject({ name: 'UI Samlingsscan', barcode });
    create.flush(testFood({ foodId: 17, name: 'UI Samlingsscan', barcode }));
    await settle();

    // The next scan finds it in the user's own catalogue – no Open Food Facts request.
    await lookUp();
    expect(root.querySelector('.barcode-scanner__result')).not.toBeNull();
  });

  it('resets everything when the sheet is reopened', async () => {
    await typeName('Meal prep');
    await addHavregryn();

    host.open.set(false);
    await settle();
    host.open.set(true);
    await settle();

    expect(root.querySelector<HTMLInputElement>('.new-collection-sheet__name input')?.value).toBe(
      '',
    );
    expect(root.querySelector('.new-collection-sheet__item-name')).toBeNull();
    expect(buttonByText('Opret samling')?.disabled).toBe(true);
  });

  function nameError(): string {
    return normalize(root.querySelector('app-ui-form-error')?.textContent);
  }

  async function reopen(): Promise<void> {
    host.open.set(false);
    await settle();
    host.open.set(true);
    await settle();
  }

  /** Loads the collections the API has – each with 150 g Havregryn as item 7. */
  function existing(...names: string[]): FoodCollection[] {
    flushTestCollections(
      names.map((name, index) =>
        testCollection(index + 1, name, [
          { mealItemId: 7, foodId: 1, foodName: 'Havregryn', quantity: 150, unit: 'Gram' },
        ]),
      ),
    );
    return [...TestBed.inject(CollectionsService).collections()];
  }

  it('blocks a name another collection already has, ignoring case and spaces', async () => {
    existing('Meal prep');

    await typeName('  MEAL prep ');

    expect(nameError()).toBe('Du har allerede en samling med det navn.');
    expect(buttonByText('Opret samling')?.disabled).toBe(true);

    await typeName('Meal prep 2');

    expect(nameError()).toBe('');
  });

  describe('in edit mode', () => {
    let collection: FoodCollection;

    beforeEach(async () => {
      [collection] = existing('Aftensmad', 'Frokost') as [FoodCollection];
      host.collection.set(collection);
      await reopen();
    });

    /** `name quantity` per draft row. */
    function draftNames(): string[] {
      return Array.from(root.querySelectorAll('.new-collection-sheet__item')).map(
        (el) =>
          `${normalize(el.querySelector('.new-collection-sheet__item-name')?.textContent)} ${normalize(el.querySelector('.new-collection-sheet__item-qty')?.textContent)}`,
      );
    }

    it('opens prefilled with the collection', () => {
      expect(normalize(root.querySelector('.ui-sheet__title-text')?.textContent)).toBe('Rediger');
      expect(root.querySelector<HTMLInputElement>('.new-collection-sheet__name input')?.value).toBe(
        'Aftensmad',
      );
      expect(draftNames()).toEqual(['Havregryn 150 g']);
    });

    it('lets the collection keep its own name and emits updated, not created', async () => {
      await addHavregryn();
      await click(buttonByText('Gem ændringer'));

      expect(nameError()).toBe('');
      expect(host.created).toEqual([]);
      expect(host.updated).toEqual([
        {
          name: 'Aftensmad',
          items: [
            expect.objectContaining({ mealItemId: 7 }),
            expect.not.objectContaining({ mealItemId: expect.anything() }),
          ],
        },
      ]);
    });

    it('calls the picker "Rediger vare" while an item’s amount is edited', async () => {
      await click(root.querySelector('.new-collection-sheet__item'));

      expect(pickerTitle()).toBe('Rediger vare');
    });

    it('re-adds an item whose amount changed, so the save replaces it', async () => {
      await click(root.querySelector('.new-collection-sheet__item'));
      await click(root.querySelectorAll('.food-picker__stepper')[1]);
      await click(root.querySelector('.food-picker__confirm'));
      await click(buttonByText('Gem ændringer'));

      expect(draftNames()).toEqual(['Havregryn 155 g']);
      expect(host.updated[0]?.items[0]).toMatchObject({ id: '1', quantity: '155 g' });
      expect(host.updated[0]?.items[0]?.mealItemId).toBeUndefined();
    });

    it('keeps an item that was opened but not changed', async () => {
      await click(root.querySelector('.new-collection-sheet__item'));
      await click(root.querySelector('.food-picker__confirm'));
      await click(buttonByText('Gem ændringer'));

      expect(host.updated[0]?.items).toEqual([collection.items[0]]);
    });

    it('can not be saved without items', async () => {
      await click(root.querySelector('.new-collection-sheet__remove'));

      expect(buttonByText('Gem ændringer')?.disabled).toBe(true);
    });

    it('blocks renaming it to another collection’s name', async () => {
      await typeName('frokost');

      expect(nameError()).toBe('Du har allerede en samling med det navn.');
      expect(buttonByText('Gem ændringer')?.disabled).toBe(true);
    });
  });
});
