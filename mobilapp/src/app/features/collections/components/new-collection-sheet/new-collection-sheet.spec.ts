import { Component, Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewCollectionInput } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { NewCollectionSheet } from './new-collection-sheet';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

@Component({
  imports: [NewCollectionSheet],
  template: `
    <app-new-collection-sheet
      [open]="open()"
      [defaultMeal]="defaultMeal()"
      (created)="created.push($event)"
      (closed)="closes = closes + 1"
    />
  `,
})
class Host {
  readonly open = signal(true);
  readonly defaultMeal = signal<MealId>('frokost');
  readonly created: NewCollectionInput[] = [];
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
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await settle();
  });

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
});
