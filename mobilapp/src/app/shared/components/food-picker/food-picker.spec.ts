import { Component, Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FoodItem } from '../../../core/models/food';
import { FoodLogService } from '../../../core/services/food-log';
import { FoodPicker, FoodPickerCtaVerb, FoodPickerSelection, FoodPickerStep } from './food-picker';
import { provideComponentTestEnvironment } from '../../../core/testing/test-providers';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`,
 * a frozen `NOW` and 0 ms mock delays. The browser's storage is cleared per test.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

/** 250 g base, so half (125 g) halves all macros without rounding. */
const SALAD: FoodItem = {
  id: 'food-salat',
  name: 'Kyllingesalat',
  quantity: '250 g',
  kcal: 380,
  protein: 30,
  carbs: 20,
  fat: 10,
};

/**
 * Items to search for. The app has no item database – search only finds the user's own items,
 * so specs insert them themselves. They're added in reverse, because the newest item comes first.
 */
const OWN_FOODS: readonly Omit<FoodItem, 'id' | 'isCustom'>[] = [
  { name: 'Havregryn', quantity: '60 g', kcal: 222, protein: 8, carbs: 38, fat: 4 },
  { name: 'Skyr naturel', quantity: '200 g', kcal: 128, protein: 22, carbs: 8, fat: 0 },
  { name: 'Banan', quantity: '1 stk', kcal: 105, protein: 1, carbs: 27, fat: 0 },
  { name: 'Kyllingebryst', quantity: '150 g', kcal: 248, protein: 46, carbs: 0, fat: 5 },
  { name: 'Rugbrød', quantity: '1 skive', kcal: 90, protein: 3, carbs: 16, fat: 1 },
  { name: 'Æg', quantity: '1 stk', kcal: 78, protein: 6, carbs: 1, fat: 5 },
  { name: 'Proteinbar', quantity: '55 g', kcal: 210, protein: 20, carbs: 22, fat: 7 },
];

function seedOwnFoods(): void {
  const log = TestBed.inject(FoodLogService);
  for (const food of [...OWN_FOODS].reverse()) {
    log.addCustomFood(food);
  }
}

@Component({
  imports: [FoodPicker],
  template: `
    <app-food-picker
      [initialQuery]="initialQuery()"
      [editItem]="editItem()"
      [editBaseItem]="editBaseItem()"
      [ctaVerb]="ctaVerb()"
      [showScan]="showScan()"
      saveAndLogLabel="Gem og log under morgenmad"
      (picked)="picked.push($event)"
      (customFoodCreated)="created.push($event)"
      (customFoodEdited)="edited.push($event)"
      (scanRequested)="scans = scans + 1"
      (stepChange)="steps.push($event)"
      (cancelled)="cancels = cancels + 1"
    />
  `,
})
class Host {
  readonly initialQuery = signal('');
  readonly editItem = signal<FoodItem | null>(null);
  readonly editBaseItem = signal<FoodItem | null>(null);
  readonly ctaVerb = signal<FoodPickerCtaVerb>('Tilføj');
  readonly showScan = signal(true);
  readonly picked: FoodPickerSelection[] = [];
  readonly created: FoodItem[] = [];
  readonly edited: FoodItem[] = [];
  readonly steps: FoodPickerStep[] = [];
  scans = 0;
  cancels = 0;
}

interface Setup {
  fixture: ComponentFixture<Host>;
  host: Host;
  root: HTMLElement;
  settle: () => Promise<void>;
  text: (selector: string) => string;
  texts: (selector: string) => string[];
  click: (selector: string, index?: number) => Promise<void>;
  typeInto: (field: HTMLInputElement | null, value: string) => Promise<void>;
  buttonByText: (label: string) => HTMLButtonElement | undefined;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

interface SetupOptions {
  /** Runs after `configureTestingModule`, before the component is created (e.g. seeding custom items). */
  readonly prepare?: () => void;
  /** Sets host inputs before the first change detection. */
  readonly configure?: (host: Host) => void;
}

describe('FoodPicker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function setup(options: SetupOptions = {}): Promise<Setup> {
    TestBed.configureTestingModule({ imports: [Host], providers: TEST_PROVIDERS });
    options.prepare?.();
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    options.configure?.(host);
    const root = fixture.nativeElement as HTMLElement;

    /** Lets effects run, the 0 ms search timer fire and the view re-render. */
    const settle = async (): Promise<void> => {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await fixture.whenStable();
    };
    const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
    const buttons = () => Array.from(root.querySelectorAll<HTMLButtonElement>('button'));

    await settle();

    return {
      fixture,
      host,
      root,
      settle,
      text: (selector) => normalize(root.querySelector(selector)?.textContent),
      texts: (selector) => all(selector).map((element) => normalize(element.textContent)),
      click: async (selector, index = 0) => {
        all(selector)[index]?.click();
        await settle();
      },
      typeInto: async (field, value) => {
        if (!field) {
          throw new Error('Feltet findes ikke.');
        }
        field.value = value;
        field.dispatchEvent(new Event('input'));
        await settle();
      },
      buttonByText: (label) => buttons().find((b) => normalize(b.textContent) === label),
    };
  }

  function searchField(root: HTMLElement): HTMLInputElement | null {
    return root.querySelector<HTMLInputElement>('.food-picker__search input');
  }

  describe('search step', () => {
    it('shows the first six of the user own foods and the blank create row', async () => {
      const { host, texts, text } = await setup({ prepare: seedOwnFoods });

      expect(host.steps).toEqual([]);
      expect(texts('.food-picker__result-name')).toEqual([
        'Havregryn Egen vare',
        'Skyr naturel Egen vare',
        'Banan Egen vare',
        'Kyllingebryst Egen vare',
        'Rugbrød Egen vare',
        'Æg Egen vare',
      ]);
      expect(text('.food-picker__result-meta')).toBe('60 g · P 8 · K 38 · F 4');
      expect(text('.food-picker__result-kcal')).toBe('222 kcal');
      expect(text('.food-picker__create-title')).toBe('Opret en vare selv');
      expect(text('.food-picker__create-sub')).toBe('Ingen stregkode nødvendig');
    });

    it('shows a spinner while searching and then only the matching foods', async () => {
      const { fixture, root, settle, texts, text } = await setup({ prepare: seedOwnFoods });
      const field = searchField(root);
      if (!field) {
        throw new Error('Søgefeltet findes ikke.');
      }

      field.value = 'havre';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(root.querySelector('app-ui-spinner')).not.toBeNull();
      expect(root.querySelectorAll('.food-picker__result')).toHaveLength(0);

      await settle();

      expect(root.querySelector('app-ui-spinner')).toBeNull();
      expect(texts('.food-picker__result-name')).toEqual(['Havregryn Egen vare']);
      expect(text('.food-picker__create-title')).toBe('Opret "havre" som ny vare');
    });

    it('shows the empty state when nothing matches', async () => {
      const { root, typeInto, text } = await setup();

      await typeInto(searchField(root), 'pizza');

      expect(root.querySelectorAll('.food-picker__result')).toHaveLength(0);
      expect(text('app-ui-empty-state')).toBe('Ingen varer matcher din søgning.');
      expect(root.querySelector('.food-picker__create')).not.toBeNull();
    });

    it('prefills the query from initialQuery and marks the user own foods', async () => {
      const { root, texts } = await setup({
        prepare: seedOwnFoods,
        configure: (host) => host.initialQuery.set('bar'),
      });

      expect(searchField(root)?.value).toBe('bar');
      expect(texts('.food-picker__result-name')).toEqual(['Proteinbar Egen vare']);
      expect(root.querySelectorAll('.food-picker__own')).toHaveLength(1);
    });

    it('emits scanRequested from the scan button and hides it when showScan is false', async () => {
      const { fixture, host, root, click } = await setup();

      await click('.food-picker__scan');
      expect(host.scans).toBe(1);

      host.showScan.set(false);
      await fixture.whenStable();
      expect(root.querySelector('.food-picker__scan')).toBeNull();
    });
  });

  describe('portion step', () => {
    it('opens the portion step for a result with its base quantity and step', async () => {
      const { host, root, click, text, texts } = await setup({ prepare: seedOwnFoods });

      await click('.food-picker__result', 2); // Banana, 1 pc

      expect(host.steps).toEqual(['portion']);
      expect(text('.food-picker__title')).toBe('Banan');
      expect(text('.food-picker__subtitle')).toBe('Standard: 1 stk · 105 kcal');
      expect(root.querySelector<HTMLInputElement>('.food-picker__amount-field')?.value).toBe('1');
      expect(texts('.food-picker__chip')).toEqual(['1 stk', '2 stk', '3 stk', '4 stk']);
      expect(text('.food-picker__confirm')).toBe('Tilføj 1 stk');

      await click('.food-picker__stepper', 1); // More
      expect(text('.food-picker__confirm')).toBe('Tilføj 2 stk');
    });

    it('halves every macro when a 250 g base is set to 125 g', async () => {
      const { host, root, click, texts, text } = await setup({
        configure: (h) => {
          h.editItem.set(SALAD);
          h.ctaVerb.set('Gem');
        },
      });

      expect(host.steps).toEqual([]);
      expect(text('.food-picker__title')).toBe('Kyllingesalat');
      expect(text('.food-picker__subtitle')).toBe('Standard: 250 g · 380 kcal');
      expect(texts('.food-picker__chip')).toEqual(['125 g', '250 g', '500 g', '750 g']);
      expect(texts('.food-picker__stat-value')).toEqual(['380', '30', '20', '10']);

      await click('.food-picker__chip', 0);

      expect(root.querySelector<HTMLInputElement>('.food-picker__amount-field')?.value).toBe('125');
      expect(texts('.food-picker__stat-value')).toEqual(['190', '15', '10', '5']);
      expect(text('.food-picker__confirm')).toBe('Gem 125 g');

      await click('.food-picker__confirm');

      expect(host.picked).toEqual([
        {
          item: { ...SALAD, quantity: '125 g', kcal: 190, protein: 15, carbs: 10, fat: 5 },
          amount: 125,
          unit: 'g',
        },
      ]);
      expect(host.steps).toEqual([]);
    });

    it('steps grams by 5 with the minus/plus buttons and typed values', async () => {
      const { root, click, typeInto, text } = await setup({
        configure: (h) => h.editItem.set(SALAD),
      });
      const field = () => root.querySelector<HTMLInputElement>('.food-picker__amount-field');

      await click('.food-picker__stepper', 0);
      expect(field()?.value).toBe('245');

      await click('.food-picker__stepper', 1);
      await click('.food-picker__stepper', 1);
      expect(field()?.value).toBe('255');

      await typeInto(field(), '100');
      expect(text('.food-picker__confirm')).toBe('Tilføj 100 g');
      expect(text('.food-picker__stat-value')).toBe('152');

      await typeInto(field(), '');
      expect(root.querySelector<HTMLButtonElement>('.food-picker__confirm')?.disabled).toBe(true);

      await click('.food-picker__stepper', 0);
      expect(field()?.value).toBe('5');
    });

    it('goes back to the search from the back button when not editing', async () => {
      const { host, root, click } = await setup({ prepare: seedOwnFoods });

      await click('.food-picker__result');
      await click('.food-picker__back');

      expect(host.steps).toEqual(['portion', 'search']);
      expect(host.cancels).toBe(0);
      expect(root.querySelector('.food-picker__search')).not.toBeNull();
    });

    it('emits cancelled from the back button when editing an item', async () => {
      const { host, root, click } = await setup({ configure: (h) => h.editItem.set(SALAD) });

      await click('.food-picker__back');

      expect(host.cancels).toBe(1);
      expect(host.steps).toEqual([]);
      expect(root.querySelector('.food-picker__title')).not.toBeNull();
    });
  });

  describe('editing a logged custom food', () => {
    const OWN_BAR: FoodItem = { ...SALAD, id: 'food-bar', name: 'Egen bar', isCustom: true };
    /** Logged as 500 g – twice the custom food's 250 g base. */
    const LOGGED_BAR: FoodItem = {
      ...OWN_BAR,
      quantity: '500 g',
      kcal: 760,
      protein: 60,
      carbs: 40,
      fat: 20,
    };

    function macroFields(root: HTMLElement): HTMLInputElement[] {
      return Array.from(root.querySelectorAll<HTMLInputElement>('.food-picker__edit-macros input'));
    }

    it('shows the custom food base macros and starts on the logged amount', async () => {
      const { root } = await setup({
        configure: (h) => {
          h.editItem.set(LOGGED_BAR);
          h.editBaseItem.set(OWN_BAR);
        },
      });

      expect(macroFields(root).map((field) => field.value)).toEqual(['380', '30', '20', '10']);
      expect(root.querySelector<HTMLInputElement>('.food-picker__amount-field')?.value).toBe('500');
    });

    it('emits the edited custom food and the recalculated entry', async () => {
      const { host, root, typeInto, click } = await setup({
        configure: (h) => {
          h.editItem.set(LOGGED_BAR);
          h.editBaseItem.set(OWN_BAR);
          h.ctaVerb.set('Gem');
        },
      });

      await typeInto(macroFields(root)[0] ?? null, '400');
      await typeInto(macroFields(root)[1] ?? null, '35');
      await click('.food-picker__confirm');

      expect(host.edited).toHaveLength(1);
      expect(host.edited[0]).toMatchObject({
        id: 'food-bar',
        quantity: '250 g',
        kcal: 400,
        protein: 35,
      });
      expect(host.picked[0]?.item).toMatchObject({ quantity: '500 g', kcal: 800, protein: 70 });
    });

    it('blocks saving with invalid macros and shows the error', async () => {
      const { host, root, typeInto, buttonByText } = await setup({
        configure: (h) => {
          h.editItem.set(LOGGED_BAR);
          h.editBaseItem.set(OWN_BAR);
          h.ctaVerb.set('Gem');
        },
      });

      await typeInto(macroFields(root)[2] ?? null, '-1');

      expect(buttonByText('Gem 500 g')?.disabled).toBe(true);
      expect(root.textContent).toContain('skal være 0 eller større');
      expect(host.edited).toEqual([]);
    });

    it('only edits the amount of a food that is not the user own', async () => {
      const { root } = await setup({ configure: (h) => h.editItem.set(SALAD) });

      expect(root.querySelector('.food-picker__edit-macros')).toBeNull();
    });
  });

  describe('new-food step', () => {
    it('rejects a name the user already has, ignoring case and spaces', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup({
        prepare: seedOwnFoods,
      });
      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, '  havregryn ');
      await typeInto(formFields(root)[2] ?? null, '100');

      expect(root.querySelector('app-ui-form-error')?.textContent).toContain(
        'allerede en egen vare med det navn',
      );
      expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(true);
      expect(buttonByText('Gem uden at logge')?.disabled).toBe(true);
      root
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
      expect(host.created).toEqual([]);

      await typeInto(formFields(root)[0] ?? null, 'Havregryn med mælk');
      expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(false);
    });

    it.each([3, 4, 5])(
      'rejects a negative macro in field %i, including direct form submission',
      async (index) => {
        const { host, root, click, typeInto, buttonByText, settle } = await setup();
        await click('.food-picker__create');
        await click('.food-picker__more');
        await typeInto(formFields(root)[0] ?? null, 'Test food');
        await typeInto(formFields(root)[2] ?? null, '100');
        await typeInto(formFields(root)[index] ?? null, '-20');
        expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(true);
        expect(buttonByText('Gem uden at logge')?.disabled).toBe(true);
        root
          .querySelector('form')!
          .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await settle();
        expect(host.created).toEqual([]);
        expect(host.picked).toEqual([]);
        expect(root.textContent).toContain('skal være 0 eller større');
        await typeInto(formFields(root)[index] ?? null, '0');
        buttonByText('Gem og log under morgenmad')?.click();
        await settle();
        expect(host.created).toHaveLength(1);
        expect(host.picked).toHaveLength(1);
      },
    );

    function formFields(root: HTMLElement): HTMLInputElement[] {
      return Array.from(root.querySelectorAll<HTMLInputElement>('.food-picker__fields input'));
    }

    it('opens from the create row with the query as name and a disabled save button', async () => {
      const { host, root, typeInto, click, text, buttonByText } = await setup();

      await typeInto(searchField(root), 'Mormors frikadeller');
      await click('.food-picker__create');

      expect(host.steps).toEqual(['new-food']);
      expect(text('.food-picker__title')).toBe('Ny egen vare');
      expect(text('.food-picker__subtitle')).toBe('Gemmes under Mine varer');
      expect(formFields(root)[0]?.value).toBe('Mormors frikadeller');
      expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(true);
      expect(buttonByText('Gem uden at logge')).toBeDefined();
      expect(formFields(root)).toHaveLength(4);

      await click('.food-picker__more');
      expect(text('.food-picker__more')).toBe('Skjul kulhydrat og fedt');
      expect(formFields(root)).toHaveLength(6);
    });

    it('emits customFoodCreated without picking for "Gem uden at logge"', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup();

      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, 'Mormors frikadeller');
      await typeInto(formFields(root)[2] ?? null, '420');
      await typeInto(formFields(root)[3] ?? null, '28');

      expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(false);

      buttonByText('Gem uden at logge')?.click();
      await settle();

      expect(host.created).toHaveLength(1);
      expect(host.created[0]).toMatchObject({
        name: 'Mormors frikadeller',
        quantity: '1 g',
        kcal: 420,
        protein: 28,
        carbs: 0,
        fat: 0,
        isCustom: true,
      });
      expect(host.created[0]?.id).toMatch(/^food-/);
      expect(host.picked).toEqual([]);
      expect(host.steps).toEqual(['new-food', 'search']);
      expect(searchField(root)?.value).toBe('');
    });

    it('emits both customFoodCreated and picked for the save-and-log button', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup();

      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, 'Proteinpandekage');
      await typeInto(formFields(root)[1] ?? null, '2');
      buttonByText('stk')?.click();
      await typeInto(formFields(root)[2] ?? null, '310');

      buttonByText('Gem og log under morgenmad')?.click();
      await settle();

      expect(host.created).toHaveLength(1);
      expect(host.picked).toHaveLength(1);
      expect(host.picked[0]?.item).toBe(host.created[0]);
      expect(host.picked[0]).toMatchObject({ amount: 2, unit: 'stk' });
      expect(host.created[0]).toMatchObject({
        name: 'Proteinpandekage',
        quantity: '2 stk',
        kcal: 310,
      });
    });
  });
});
