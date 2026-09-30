import { HttpTestingController } from '@angular/common/http/testing';
import { Component, Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FoodCollection, NewCollectionInput } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { NewCollectionSheet } from './new-collection-sheet';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';
import { FoodItem } from '../../../../core/models/food';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import { flushTestFoodLog, testFood } from '../../../../core/testing/fixtures';
import { FoodPicker } from '../../../../shared/components/food-picker/food-picker';

const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

@Component({
  imports: [NewCollectionSheet],
  template: `
    <app-new-collection-sheet
      [open]="open()"
      [defaultMeal]="defaultMeal()"
      [collection]="collection()"
      (created)="created.push($event)"
      (updated)="updated.push($event)"
      (closed)="closes = closes + 1"
    />
  `,
})
class Host {
  readonly open = signal(true);
  readonly defaultMeal = signal<MealId>('frokost');
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

  function icons(): HTMLButtonElement[] {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('.new-collection-sheet__icon'));
  }

  function selectedIconLabel(): string | null | undefined {
    return root
      .querySelector('.new-collection-sheet__icon[aria-checked="true"]')
      ?.getAttribute('aria-label');
  }

  async function pressOnIcons(key: string): Promise<void> {
    root
      .querySelector('.new-collection-sheet__icons')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
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
    flushTestFoodLog([testFood({ foodId: 1, name: 'Havregryn', caloriesPer100: 370 })]);
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await settle();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('opens on the meal it was given and shows the first twelve icons', () => {
    const meals = Array.from(root.querySelectorAll<HTMLElement>('.meal-picker__option'));
    const selected = meals.find((meal) => meal.getAttribute('aria-checked') === 'true');

    expect(normalize(selected?.textContent)).toBe('Frokost');
    expect(root.querySelectorAll('.new-collection-sheet__icon')).toHaveLength(12);
    expect(normalize(root.querySelector('.new-collection-sheet__more')?.textContent)).toBe(
      'Vis flere (18)',
    );
  });

  it('reveals the remaining icons and folds them away again', async () => {
    await click(root.querySelector('.new-collection-sheet__more'));

    expect(root.querySelectorAll('.new-collection-sheet__icon')).toHaveLength(30);
    expect(normalize(root.querySelector('.new-collection-sheet__more')?.textContent)).toBe(
      'Vis færre',
    );

    await click(root.querySelector('.new-collection-sheet__more'));

    expect(root.querySelectorAll('.new-collection-sheet__icon')).toHaveLength(12);
  });

  it('names every icon in Danish for screen readers', () => {
    expect(icons()[0]?.getAttribute('aria-label')).toBe('Æg');
    expect(icons()[11]?.getAttribute('aria-label')).toBe('Håndvægt');
  });

  it('walks the icon grid with the arrow keys and wraps around', async () => {
    expect(selectedIconLabel()).toBe('Stjerne');

    await pressOnIcons('ArrowRight');
    expect(selectedIconLabel()).toBe('Håndvægt');

    await pressOnIcons('ArrowRight');
    expect(selectedIconLabel()).toBe('Æg');

    await pressOnIcons('ArrowDown');
    expect(selectedIconLabel()).toBe('Fisk');

    await pressOnIcons('ArrowUp');
    expect(selectedIconLabel()).toBe('Æg');

    await pressOnIcons('ArrowLeft');
    expect(selectedIconLabel()).toBe('Håndvægt');
  });

  it('keeps only the selected icon in the tab order and follows it with focus', async () => {
    expect(icons().map((icon) => icon.tabIndex)).toEqual([
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1,
    ]);

    await pressOnIcons('ArrowRight');

    expect(document.activeElement).toBe(icons()[11]);
    expect(icons()[11]?.tabIndex).toBe(0);
  });

  it('leaves the icon grid alone on keys that are not arrows', async () => {
    await pressOnIcons('Enter');

    expect(selectedIconLabel()).toBe('Stjerne');
  });

  it('hands the tab order to the first icon when the selected one is folded away', async () => {
    await click(root.querySelector('.new-collection-sheet__more'));
    await click(icons()[20]);

    expect(selectedIconLabel()).toBe('Mælk');

    await click(root.querySelector('.new-collection-sheet__more'));

    expect(icons()).toHaveLength(12);
    expect(selectedIconLabel()).toBeUndefined();
    expect(icons()[0]?.tabIndex).toBe(0);
  });

  it('starts with an empty draft and the design’s hint', () => {
    expect(normalize(root.querySelector('app-ui-empty-state')?.textContent)).toBe(
      'Søg en vare eller scan en stregkode for at fylde samlingen.',
    );
  });

  it('keeps "Opret samling" disabled until the collection has a name', async () => {
    const create = () => buttonByText('Opret samling');

    expect(create()?.disabled).toBe(true);

    await typeName('Meal prep');

    expect(create()?.disabled).toBe(false);
  });

  it('emits the name, the picked meal and the picked icon', async () => {
    await typeName('Meal prep');
    await click(root.querySelectorAll('.meal-picker__option')[3]);
    await click(root.querySelectorAll('.new-collection-sheet__icon')[2]);
    await click(buttonByText('Opret samling'));

    expect(host.created).toHaveLength(1);
    expect(host.created[0]).toMatchObject({
      name: 'Meal prep',
      meal: 'snack',
      icon: 'utensils',
      items: [],
    });
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
    fixture.debugElement.query(By.directive(FoodPicker)).triggerEventHandler('picked', {
      item: {
        id: 'food-new',
        name: 'Havregryn',
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
    ).toEqual(['Havregryn']);
    expect(
      normalize(root.querySelector('.new-collection-sheet__custom-error')?.textContent),
    ).toContain('allerede en egen vare med navnet');
  });

  it('resets everything when the sheet is reopened', async () => {
    await typeName('Meal prep');
    await click(root.querySelector('.new-collection-sheet__more'));

    host.open.set(false);
    await settle();
    host.open.set(true);
    await settle();

    expect(root.querySelector<HTMLInputElement>('.new-collection-sheet__name input')?.value).toBe(
      '',
    );
    expect(root.querySelectorAll('.new-collection-sheet__icon')).toHaveLength(12);
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

  function existing(name: string): FoodCollection {
    return TestBed.inject(CollectionsService).create({
      name,
      icon: 'fish',
      meal: 'aften',
      items: [
        {
          id: 'item-laks',
          name: 'Laks',
          quantity: '150 g',
          kcal: 300,
          protein: 30,
          carbs: 0,
          fat: 20,
        },
      ],
    });
  }

  it('blocks a name another collection already has, ignoring case and spaces', async () => {
    existing('Meal prep');

    await typeName('  MEAL prep ');

    expect(nameError()).toBe('Du har allerede en samling med det navn.');
    expect(buttonByText('Opret samling')?.disabled).toBe(true);

    await typeName('Meal prep 2');

    expect(nameError()).toBe('');
    expect(buttonByText('Opret samling')?.disabled).toBe(false);
  });

  describe('in edit mode', () => {
    let collection: FoodCollection;

    beforeEach(async () => {
      collection = existing('Aftensmad');
      host.collection.set(collection);
      await reopen();
    });

    it('opens prefilled with the collection', () => {
      expect(normalize(root.querySelector('.ui-sheet__title-text')?.textContent)).toBe('Rediger');
      expect(root.querySelector<HTMLInputElement>('.new-collection-sheet__name input')?.value).toBe(
        'Aftensmad',
      );
      expect(selectedIconLabel()).toBe('Fisk');
      const meals = Array.from(root.querySelectorAll<HTMLElement>('.meal-picker__option'));
      expect(
        normalize(meals.find((meal) => meal.getAttribute('aria-checked') === 'true')?.textContent),
      ).toBe('Aftensmad');
      expect(
        Array.from(root.querySelectorAll('.new-collection-sheet__item-name')).map((el) =>
          normalize(el.textContent),
        ),
      ).toEqual(['Laks']);
    });

    it('lets the collection keep its own name and emits updated, not created', async () => {
      await click(root.querySelector('.new-collection-sheet__remove'));
      await click(buttonByText('Gem ændringer'));

      expect(nameError()).toBe('');
      expect(host.created).toEqual([]);
      expect(host.updated).toEqual([{ name: 'Aftensmad', icon: 'fish', meal: 'aften', items: [] }]);
    });

    it('blocks renaming it to another collection’s name', async () => {
      existing('Frokost');

      await typeName('frokost');

      expect(nameError()).toBe('Du har allerede en samling med det navn.');
      expect(buttonByText('Gem ændringer')?.disabled).toBe(true);
    });
  });
});
