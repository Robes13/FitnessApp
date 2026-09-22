import { Component, Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FoodItem } from '../../../core/models/food';
import { FoodLogService } from '../../../core/services/food-log';
import { FoodPicker, FoodPickerCtaVerb, FoodPickerSelection, FoodPickerStep } from './food-picker';
import { provideComponentTestEnvironment } from '../../../core/testing/test-providers';

/**
 * Komponenttests bruger `provideComponentTestEnvironment()`: jsdom's rigtige `DOCUMENT`,
 * fastfrosset `NOW` og 0 ms mock-forsinkelser. Browserens storage ryddes pr. test.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

/** 250 g-basis, så halvdelen (125 g) halverer alle makroer uden afrunding. */
const SALAD: FoodItem = {
  id: 'food-salat',
  name: 'Kyllingesalat',
  quantity: '250 g',
  kcal: 380,
  protein: 30,
  carbs: 20,
  fat: 10,
};

@Component({
  imports: [FoodPicker],
  template: `
    <app-food-picker
      [initialQuery]="initialQuery()"
      [editItem]="editItem()"
      [ctaVerb]="ctaVerb()"
      [showScan]="showScan()"
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
  readonly editItem = signal<FoodItem | null>(null);
  readonly ctaVerb = signal<FoodPickerCtaVerb>('Tilføj');
  readonly showScan = signal(true);
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
  /** Kører efter `configureTestingModule`, før komponenten oprettes (fx seed af egne varer). */
  readonly prepare?: () => void;
  /** Sætter host-inputs, før første change detection. */
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

    /** Lader effekter køre, den 0 ms lange søgetimer udløbe og viewet tegne igen. */
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
    it('shows the first six foods for an empty query and the blank create row', async () => {
      const { host, texts, text } = await setup();

      expect(host.steps).toEqual([]);
      expect(texts('.food-picker__result-name')).toEqual([
        'Havregryn',
        'Skyr naturel',
        'Banan',
        'Kyllingebryst',
        'Rugbrød',
        'Æg',
      ]);
      expect(text('.food-picker__result-meta')).toBe('60 g · P 8 · K 38 · F 4');
      expect(text('.food-picker__result-kcal')).toBe('222 kcal');
      expect(text('.food-picker__create-title')).toBe('Opret en vare selv');
      expect(text('.food-picker__create-sub')).toBe('Ingen stregkode nødvendig');
    });

    it('shows a spinner while searching and then only the matching foods', async () => {
      const { fixture, root, settle, texts, text } = await setup();
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
      expect(texts('.food-picker__result-name')).toEqual(['Havregryn']);
      expect(text('.food-picker__create-title')).toBe('Opret "havre" som ny vare');
    });

    it('shows the empty state when nothing matches', async () => {
      const { root, typeInto, text } = await setup();

      await typeInto(searchField(root), 'pizza');

      expect(root.querySelectorAll('.food-picker__result')).toHaveLength(0);
      expect(text('app-ui-empty-state')).toBe('Ingen varer matcher din søgning.');
      expect(root.querySelector('.food-picker__create')).not.toBeNull();
    });

    it('prefills the query from initialQuery and marks custom foods', async () => {
      const { root, texts } = await setup({
        prepare: () =>
          TestBed.inject(FoodLogService).addCustomFood({
            name: 'Min bar',
            quantity: '1 stk',
            kcal: 200,
            protein: 20,
            carbs: 20,
            fat: 5,
          }),
        configure: (host) => host.initialQuery.set('bar'),
      });

      expect(searchField(root)?.value).toBe('bar');
      expect(texts('.food-picker__result-name')).toEqual(['Min bar Egen vare', 'Proteinbar']);
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
      const { host, root, click, text, texts } = await setup();

      await click('.food-picker__result', 2); // Banan, 1 stk

      expect(host.steps).toEqual(['portion']);
      expect(text('.food-picker__title')).toBe('Banan');
      expect(text('.food-picker__subtitle')).toBe('Standard: 1 stk · 105 kcal');
      expect(root.querySelector<HTMLInputElement>('.food-picker__amount-field')?.value).toBe('1');
      expect(texts('.food-picker__chip')).toEqual(['1 stk', '2 stk', '3 stk', '4 stk']);
      expect(text('.food-picker__confirm')).toBe('Tilføj 1 stk');

      await click('.food-picker__stepper', 1); // Mere
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
      const { host, root, click } = await setup();

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

  describe('new-food step', () => {
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
