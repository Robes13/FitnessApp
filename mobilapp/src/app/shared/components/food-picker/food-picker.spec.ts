import { Component, Provider, signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FoodItem } from '../../../core/models/food';
import { FoodDto } from '../../../core/models/food-api';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { flushTestFoodLog, testFood } from '../../../core/testing/fixtures';
import {
  FoodPicker,
  FoodPickerCtaVerb,
  FoodPickerSelection,
  FoodPickerStartStep,
  FoodPickerStep,
} from './food-picker';
import { provideComponentTestEnvironment } from '../../../core/testing/test-providers';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT` and a
 * frozen `NOW`. The browser's storage is cleared per test.
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

const PIECE = [{ foodServingId: 1, unit: 'Piece' as const, gramsPerUnit: 100 }];

/**
 * Items to search for: the user's catalogue as the API returns it, newest first (per 100 g, or
 * per piece with the synthetic piece serving). There is no shared food database.
 */
const OWN_FOODS: readonly FoodDto[] = [
  own(7, 'Havregryn', [370, 13, 60, 7]),
  own(6, 'Skyr naturel', [64, 11, 4, 0]),
  own(5, 'Banan', [105, 1, 27, 0], PIECE),
  own(4, 'Kyllingebryst', [165, 31, 0, 4]),
  own(3, 'Rugbrød', [90, 3, 16, 1], PIECE),
  own(2, 'Æg', [78, 6, 1, 5], PIECE),
  own(1, 'Proteinbar', [380, 36, 40, 13]),
];

function own(
  foodId: number,
  name: string,
  [caloriesPer100, proteinPer100, carbohydratesPer100, fatPer100]: readonly number[],
  servings: FoodDto['servings'] = [],
): FoodDto {
  return testFood({
    foodId,
    name,
    caloriesPer100,
    proteinPer100,
    carbohydratesPer100,
    fatPer100,
    servings,
  });
}

function seedOwnFoods(): void {
  flushTestFoodLog(OWN_FOODS);
}

@Component({
  imports: [FoodPicker],
  template: `
    <app-food-picker
      [initialQuery]="initialQuery()"
      [startStep]="startStep()"
      [barcode]="barcode()"
      [editItem]="editItem()"
      [ctaVerb]="ctaVerb()"
      [showScan]="showScan()"
      [busy]="busy()"
      saveAndLogLabel="Gem og log under morgenmad"
      (picked)="picked.push($event)"
      (customFoodCreated)="created.push($event)"
      (scanRequested)="scans = scans + 1"
      (stepChange)="steps.push($event)"
      (cancelled)="cancels = cancels + 1"
    />
  `,
})
class Host {
  readonly initialQuery = signal('');
  readonly startStep = signal<FoodPickerStartStep>('search');
  readonly barcode = signal<string | null>(null);
  readonly editItem = signal<FoodItem | null>(null);
  readonly ctaVerb = signal<FoodPickerCtaVerb>('Tilføj');
  readonly showScan = signal(true);
  readonly busy = signal(false);
  readonly picked: FoodPickerSelection[] = [];
  readonly created: FoodItem[] = [];
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

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function setup(options: SetupOptions = {}): Promise<Setup> {
    TestBed.configureTestingModule({ imports: [Host], providers: TEST_PROVIDERS });
    options.prepare?.();
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    options.configure?.(host);
    const root = fixture.nativeElement as HTMLElement;

    /** Lets effects run and the view re-render. */
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
      expect(text('.food-picker__result-meta')).toBe('100 g · P 13 · K 60 · F 7');
      expect(text('.food-picker__result-kcal')).toBe('370 kcal');
      expect(text('.food-picker__create-title')).toBe('Opret en vare selv');
      expect(text('.food-picker__create-sub')).toBe('Ingen stregkode nødvendig');
    });

    it('shows a catalogue food with decimals in whole numbers', async () => {
      const { text } = await setup({
        prepare: () => flushTestFoodLog([own(8, 'Yoghurt', [61.5, 2.67, 4.5, 3.49])]),
      });

      expect(text('.food-picker__result-meta')).toBe('100 g · P 3 · K 5 · F 3');
      expect(text('.food-picker__result-kcal')).toBe('62 kcal');
    });

    it('writes kcal from 1000 up with a thousands separator, in the list and the portion', async () => {
      const { click, text, texts } = await setup({
        prepare: () => flushTestFoodLog([own(9, 'Festmåltid', [1600, 85, 120, 60], PIECE)]),
      });

      expect(text('.food-picker__result-kcal')).toBe('1.600 kcal');

      await click('.food-picker__result');

      expect(text('.food-picker__subtitle')).toBe('Standard: 1 stk · 1.600 kcal');
      expect(texts('.food-picker__stat-value')).toEqual(['1.600', '85', '120', '60']);
    });

    it('shows only the matching foods for a search', async () => {
      const { root, typeInto, texts, text } = await setup({ prepare: seedOwnFoods });

      await typeInto(searchField(root), 'havre');

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

    it('explains the empty list before anything is searched', async () => {
      const { settle, text } = await setup();

      await settle();

      expect(text('app-ui-empty-state')).toBe(
        'Du har ingen varer endnu. Søg, scan en stregkode eller opret en selv.',
      );
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

    it('measures a 100 ml food like grams: 5 ml steps and chips from the base', async () => {
      const { click, text, texts } = await setup({
        configure: (h) => h.editItem.set({ ...SALAD, quantity: '100 ml', kcal: 45 }),
      });

      expect(texts('.food-picker__chip')).toEqual(['50 ml', '100 ml', '200 ml', '300 ml']);

      await click('.food-picker__stepper', 1);
      expect(text('.food-picker__confirm')).toBe('Tilføj 105 ml');
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

    it('scales a catalogue food from its own values, so it rounds only once', async () => {
      const { host, root, click, typeInto, text, texts } = await setup({
        prepare: () => flushTestFoodLog([own(8, 'Yoghurt', [61.5, 2.67, 4.5, 3.49])]),
      });

      await click('.food-picker__result');
      expect(text('.food-picker__subtitle')).toBe('Standard: 100 g · 62 kcal');
      await typeInto(root.querySelector<HTMLInputElement>('.food-picker__amount-field'), '150');

      // 150 g × 2.67 / 100 = 4.005 g protein – not 1.5 × the rounded 3 g.
      expect(texts('.food-picker__stat-value')).toEqual(['92', '4', '7', '5']);
      await click('.food-picker__confirm');
      expect(host.picked[0]?.item).toMatchObject({
        id: '8',
        quantity: '150 g',
        kcal: 92,
        protein: 4,
        carbs: 7,
        fat: 5,
      });
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

  describe('editing a logged food', () => {
    /** Logged as 1 portion of a food with 9999 kcal per portion – the most one log may hold. */
    const BIG_PORTION: FoodItem = {
      id: '9',
      name: 'Stor portion',
      quantity: '1 portion',
      kcal: 9999,
      protein: 50,
      carbs: 20,
      fat: 10,
    };

    it('previews a new amount from the food itself, not from the rounded row', async () => {
      const cola = own(
        3,
        'Coca Cola',
        [42, 0, 10.6, 0],
        [{ foodServingId: 1, unit: 'Milliliter', gramsPerUnit: 1 }],
      );
      const { root, typeInto, texts } = await setup({
        prepare: () => flushTestFoodLog([cola]),
        // The logged row: 330 ml with 34.98 g carbs, shown as 35.
        configure: (h) =>
          h.editItem.set({
            id: '3',
            name: 'Coca Cola',
            quantity: '330 ml',
            kcal: 139,
            protein: 0,
            carbs: 35,
            fat: 0,
          }),
      });

      expect(texts('.food-picker__stat-value')).toEqual(['139', '0', '35', '0']);
      await typeInto(root.querySelector<HTMLInputElement>('.food-picker__amount-field'), '30000');

      // What the API logs: 30000 ml × 10.6 / 100 – not 35 × 30000 / 330 = 3182.
      expect(texts('.food-picker__stat-value')).toEqual(['12.600', '0', '3.180', '0']);
    });

    it('only changes the amount – there are no macro fields', async () => {
      const { root } = await setup({ configure: (h) => h.editItem.set(SALAD) });

      expect(root.querySelectorAll('.food-picker__step--portion input')).toHaveLength(1);
      expect(root.querySelector('.food-picker__amount-field')).not.toBeNull();
    });

    it('blocks a log that the API could not store and asks to split it up', async () => {
      const { host, root, typeInto, text, click } = await setup({
        configure: (h) => h.editItem.set(BIG_PORTION),
      });
      const field = () => root.querySelector<HTMLInputElement>('.food-picker__amount-field');

      await typeInto(field(), '20');

      expect(root.querySelector<HTMLButtonElement>('.food-picker__confirm')?.disabled).toBe(true);
      expect(text('.food-picker__step--portion app-ui-form-error')).toBe(
        'Det er for meget til én logning – del den op.',
      );
      await click('.food-picker__confirm');
      expect(host.picked).toEqual([]);

      await typeInto(field(), '1');
      expect(root.querySelector<HTMLButtonElement>('.food-picker__confirm')?.disabled).toBe(false);
      expect(root.querySelector('.food-picker__step--portion app-ui-form-error')).toBeNull();
    });

    it('shows a spinner and ignores taps while the parent saves', async () => {
      const { host, root, click } = await setup({
        configure: (h) => {
          h.editItem.set(SALAD);
          h.busy.set(true);
        },
      });

      await click('.food-picker__confirm');

      expect(root.querySelector('.food-picker__confirm')?.getAttribute('aria-busy')).toBe('true');
      expect(host.picked).toEqual([]);
    });
  });

  describe('new-food step', () => {
    function formFields(root: HTMLElement): HTMLInputElement[] {
      return Array.from(root.querySelectorAll<HTMLInputElement>('.food-picker__fields input'));
    }

    /** The message under the field with `label` (`Navn`, `Portion`, `Kalorier`, `Protein (g)` …). */
    function fieldError(root: HTMLElement, label: string): string | null {
      const field = Array.from(root.querySelectorAll('.food-picker__field')).find(
        (candidate) =>
          normalize(candidate.querySelector('.food-picker__label')?.textContent) === label,
      );
      if (!field) {
        throw new Error(`Intet felt med etiketten "${label}"`);
      }
      const error = field.querySelector('app-ui-form-error');
      return error ? normalize(error.textContent) : null;
    }

    /** Opens "Ny egen vare" (with carbs and fat) and fills name, amount and kcal. */
    async function openFilled(setupResult: Setup, amount: string, kcal: string): Promise<void> {
      const { root, click, typeInto } = setupResult;
      await click('.food-picker__create');
      await click('.food-picker__more');
      await typeInto(formFields(root)[0] ?? null, 'Test food');
      await typeInto(formFields(root)[1] ?? null, amount);
      await typeInto(formFields(root)[2] ?? null, kcal);
    }

    it('rejects a name the user already has, ignoring case and spaces', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup({
        prepare: seedOwnFoods,
      });
      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, '  havregryn ');
      await typeInto(formFields(root)[1] ?? null, '100');
      await typeInto(formFields(root)[2] ?? null, '100');

      expect(fieldError(root, 'Navn')).toBe('Du har allerede en egen vare med det navn.');
      buttonByText('Gem uden at logge')?.click();
      root
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
      expect(host.created).toEqual([]);
      expect(host.picked).toEqual([]);

      await typeInto(formFields(root)[0] ?? null, 'Havregryn med mælk');
      expect(fieldError(root, 'Navn')).toBeNull();
      buttonByText('Gem og log under morgenmad')?.click();
      await settle();
      expect(host.picked).toHaveLength(1);
    });

    it.each<[number, string]>([
      [3, 'Protein (g)'],
      [4, 'Kulhydrat (g)'],
      [5, 'Fedt (g)'],
    ])(
      'rejects a negative macro in field %i under that field, including direct form submission',
      async (index, label) => {
        const setupResult = await setup();
        const { host, root, typeInto, buttonByText, settle } = setupResult;
        await openFilled(setupResult, '100', '100');
        await typeInto(formFields(root)[index] ?? null, '-20');
        expect(fieldError(root, label)).toBe('Skal være 0 eller større.');
        buttonByText('Gem og log under morgenmad')?.click();
        buttonByText('Gem uden at logge')?.click();
        root
          .querySelector('form')!
          .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await settle();
        expect(host.picked).toEqual([]);
        expect(host.created).toEqual([]);
        await typeInto(formFields(root)[index] ?? null, '0');
        expect(fieldError(root, label)).toBeNull();
        buttonByText('Gem og log under morgenmad')?.click();
        await settle();
        expect(host.picked).toHaveLength(1);
      },
    );

    it.each<[string, string, string, number, string, string, string]>([
      ['more than 9999 kcal', '1', 'stk', 2, '10000', 'Kalorier', 'Højst 9.999 kcal pr. portion.'],
      [
        'more than 999 g of a macro',
        '1',
        'stk',
        3,
        '1000',
        'Protein (g)',
        'Højst 999 g pr. portion.',
      ],
      [
        'more than 900 kcal per 100 g',
        '50',
        'g',
        2,
        '451',
        'Portion',
        'Portionen er for lille til så mange kalorier eller makroer.',
      ],
      [
        'more macros than the amount weighs',
        '50',
        'g',
        4,
        '51',
        'Portion',
        'Portionen er for lille til så mange kalorier eller makroer.',
      ],
    ])(
      'rejects %s, which the API could not store, under the field it is about',
      async (_, amount, unit, index, value, label, message) => {
        const setupResult = await setup();
        const { host, root, typeInto, buttonByText, settle, texts } = setupResult;
        await openFilled(setupResult, amount, '100');
        buttonByText(unit)?.click();
        await typeInto(formFields(root)[index] ?? null, value);

        expect(fieldError(root, label)).toBe(message);
        expect(texts('app-ui-form-error')).toEqual([message]);
        buttonByText('Gem og log under morgenmad')?.click();
        buttonByText('Gem uden at logge')?.click();
        await settle();
        expect(host.picked).toEqual([]);
        expect(host.created).toEqual([]);
      },
    );

    it('says what is missing under the field when an incomplete form is saved (3.0-7a)', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup();
      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, '   ');
      await typeInto(formFields(root)[1] ?? null, '150');

      // Nothing is wrong yet – the required fields only speak up on save.
      expect(root.querySelector('app-ui-form-error')).toBeNull();
      buttonByText('Gem og log under morgenmad')?.click();
      await settle();

      expect(host.picked).toEqual([]);
      expect(fieldError(root, 'Navn')).toBe('Skriv varens navn.');
      expect(fieldError(root, 'Kalorier')).toBe('Skriv kalorierne for portionen.');
      expect(fieldError(root, 'Portion')).toBeNull();

      await typeInto(formFields(root)[0] ?? null, 'Skyr');
      await typeInto(formFields(root)[2] ?? null, '120');
      expect(root.querySelector('app-ui-form-error')).toBeNull();
      buttonByText('Gem uden at logge')?.click();
      await settle();
      expect(host.created).toHaveLength(1);
    });

    it('asks for the amount when an empty one (1 g) cannot hold the kcal', async () => {
      const { root, click, typeInto } = await setup();
      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, 'Skyr');
      await typeInto(formFields(root)[2] ?? null, '120');

      expect(fieldError(root, 'Portion')).toBe('Skriv portionens størrelse.');
      expect(fieldError(root, 'Kalorier')).toBeNull();

      await typeInto(formFields(root)[1] ?? null, '150');
      expect(fieldError(root, 'Portion')).toBeNull();
    });

    it('unfolds carbs and fat when one of them is wrong on save', async () => {
      const setupResult = await setup();
      const { root, click, typeInto, buttonByText, settle } = setupResult;
      await openFilled(setupResult, '100', '100');
      await typeInto(formFields(root)[4] ?? null, '-1');
      await click('.food-picker__more');
      expect(formFields(root)).toHaveLength(4);

      buttonByText('Gem og log under morgenmad')?.click();
      await settle();

      expect(formFields(root)).toHaveLength(6);
      expect(fieldError(root, 'Kulhydrat (g)')).toBe('Skal være 0 eller større.');
    });

    it('accepts large values per piece and a plausible food in grams', async () => {
      const setupResult = await setup();
      const { root, typeInto, buttonByText } = setupResult;
      await openFilled(setupResult, '1', '9999');
      buttonByText('stk')?.click();
      await typeInto(formFields(root)[3] ?? null, '999');

      expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(false);

      buttonByText('g')?.click();
      await typeInto(formFields(root)[1] ?? null, '2000');
      await typeInto(formFields(root)[2] ?? null, '9000');
      expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(false);
    });

    it('rejects too few kcal, an amount below 1 and a name over 150 characters', async () => {
      const setupResult = await setup();
      const { host, root, typeInto, buttonByText, settle } = setupResult;
      await openFilled(setupResult, '100', '0');

      expect(fieldError(root, 'Kalorier')).toBe('Kalorier skal være mindst 1.');

      await typeInto(formFields(root)[2] ?? null, '100');
      await typeInto(formFields(root)[1] ?? null, '0');
      expect(fieldError(root, 'Kalorier')).toBeNull();
      expect(fieldError(root, 'Portion')).toBe('Portionen skal være mindst 1.');

      await typeInto(formFields(root)[1] ?? null, '100');
      await typeInto(formFields(root)[0] ?? null, 'x'.repeat(151));
      expect(fieldError(root, 'Navn')).toBe('Navnet må højst have 150 tegn.');
      expect(formFields(root)[0]?.maxLength).toBe(150);
      buttonByText('Gem og log under morgenmad')?.click();
      await settle();
      expect(host.picked).toEqual([]);
    });

    it('opens from the create row with the query as name and no errors yet', async () => {
      const { host, root, typeInto, click, text, buttonByText } = await setup();

      await typeInto(searchField(root), 'Mormors frikadeller');
      await click('.food-picker__create');

      expect(host.steps).toEqual(['new-food']);
      expect(text('.food-picker__title')).toBe('Ny egen vare');
      expect(text('.food-picker__subtitle')).toBe('Gemmes under Mine varer');
      expect(formFields(root)[0]?.value).toBe('Mormors frikadeller');
      expect(root.querySelector('app-ui-form-error')).toBeNull();
      expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(false);
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
      await typeInto(formFields(root)[1] ?? null, '200');
      await typeInto(formFields(root)[2] ?? null, '420');
      await typeInto(formFields(root)[3] ?? null, '28');

      expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(false);

      buttonByText('Gem uden at logge')?.click();
      await settle();

      // The form stays until the parent has saved the food, so a failed save keeps what was typed.
      expect(host.steps).toEqual(['new-food']);
      expect(host.created).toHaveLength(1);
      expect(host.created[0]).toMatchObject({
        name: 'Mormors frikadeller',
        quantity: '200 g',
        kcal: 420,
        protein: 28,
        carbs: 0,
        fat: 0,
        isCustom: true,
      });
      expect(host.created[0]?.id).toMatch(/^food-/);
      expect(host.picked).toEqual([]);

      const created = host.created[0];
      if (created) {
        TestBed.inject(FoodLogService).addCustomFood(created).subscribe();
      }
      TestBed.inject(HttpTestingController)
        .expectOne({ method: 'POST', url: '/api/v1/foods' })
        .flush(testFood({ foodId: 9, name: 'Mormors frikadeller' }));
      await settle();

      expect(host.steps).toEqual(['new-food', 'search']);
      expect(searchField(root)?.value).toBe('');
    });

    it('lets a save-and-log be retried after the food was created but the log failed', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup();

      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, 'Proteinpandekage');
      await typeInto(formFields(root)[1] ?? null, '100');
      await typeInto(formFields(root)[2] ?? null, '310');
      buttonByText('Gem og log under morgenmad')?.click();
      await settle();
      expect(host.picked).toHaveLength(1);
      // The parent's add() created the food; its log failed, so the form is still open.
      flushTestFoodLog([testFood({ foodId: 9, name: 'Proteinpandekage' })]);
      await settle();

      expect(root.textContent).not.toContain('allerede en egen vare med det navn');
      expect(buttonByText('Gem og log under morgenmad')?.disabled).toBe(false);
      buttonByText('Gem og log under morgenmad')?.click();
      await settle();

      expect(host.picked).toHaveLength(2);
    });

    it('treats the name as taken once the form changes after a failed save-and-log', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup();

      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, 'Proteinpandekage');
      await typeInto(formFields(root)[1] ?? null, '100');
      await typeInto(formFields(root)[2] ?? null, '310');
      buttonByText('Gem og log under morgenmad')?.click();
      await settle();
      // The parent's add() created the food with these values; its log failed.
      flushTestFoodLog([testFood({ foodId: 9, name: 'Proteinpandekage', caloriesPer100: 310 })]);
      await settle();

      // A retry would reuse the food by name and log the first values, so the name is taken now.
      await typeInto(formFields(root)[2] ?? null, '600');

      expect(fieldError(root, 'Navn')).toBe('Du har allerede en egen vare med det navn.');
      buttonByText('Gem og log under morgenmad')?.click();
      root
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
      expect(host.picked).toHaveLength(1);
    });

    it('stays on the form after "Gem uden at logge" until the food has its unit', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup();

      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, 'Kiks');
      await typeInto(formFields(root)[1] ?? null, '1');
      buttonByText('stk')?.click();
      await typeInto(formFields(root)[2] ?? null, '80');
      buttonByText('Gem uden at logge')?.click();
      await settle();
      expect(host.created).toHaveLength(1);

      // POST foods succeeded, but the piece serving failed: the food shows as 100 g.
      flushTestFoodLog([testFood({ foodId: 9, name: 'Kiks', caloriesPer100: 80 })]);
      await settle();
      expect(host.steps).toEqual(['new-food']);
      expect(root.textContent).not.toContain('allerede en egen vare med det navn');

      // The same tap again: the parent's addCustomFood only adds the serving.
      buttonByText('Gem uden at logge')?.click();
      await settle();
      expect(host.created).toHaveLength(2);
      flushTestFoodLog([
        testFood({ foodId: 9, name: 'Kiks', caloriesPer100: 80, servings: PIECE }),
      ]);
      await settle();

      expect(host.steps).toEqual(['new-food', 'search']);
    });

    it('puts the barcode on the food from the form the scanner opened, not on a later one', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup({
        configure: (h) => {
          h.startStep.set('new-food');
          h.barcode.set('5799999999991');
        },
      });
      await typeInto(formFields(root)[0] ?? null, 'Ukendt bar');
      await typeInto(formFields(root)[1] ?? null, '40');
      await typeInto(formFields(root)[2] ?? null, '180');
      buttonByText('Gem og log under morgenmad')?.click();
      await settle();

      expect(host.picked[0]?.item).toMatchObject({ name: 'Ukendt bar', barcode: '5799999999991' });

      await click('.food-picker__back');
      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, 'Andet');
      await typeInto(formFields(root)[2] ?? null, '1');
      buttonByText('Gem uden at logge')?.click();
      await settle();
      expect(host.created[0]?.barcode).toBeUndefined();
    });

    it('emits only picked, once, for the save-and-log button and keeps the form', async () => {
      const { host, root, click, typeInto, buttonByText, settle } = await setup();

      await click('.food-picker__create');
      await typeInto(formFields(root)[0] ?? null, 'Proteinpandekage');
      await typeInto(formFields(root)[1] ?? null, '2');
      buttonByText('stk')?.click();
      await typeInto(formFields(root)[2] ?? null, '310');

      buttonByText('Gem og log under morgenmad')?.click();
      await settle();

      expect(host.created).toEqual([]);
      expect(host.picked).toHaveLength(1);
      expect(host.picked[0]).toMatchObject({ amount: 2, unit: 'stk' });
      expect(host.picked[0]?.item).toMatchObject({
        name: 'Proteinpandekage',
        quantity: '2 stk',
        kcal: 310,
        isCustom: true,
      });
      expect(host.picked[0]?.item.id).toMatch(/^food-/);
      expect(host.steps).toEqual(['new-food']);
      expect(formFields(root)[0]?.value).toBe('Proteinpandekage');
    });
  });
});
