import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { concat, map, of, switchMap } from 'rxjs';
import { DEFAULT_QUANTITY_UNIT } from '../../../core/constants/nutrition';
import { FoodItem, Macros } from '../../../core/models/food';
import { FoodSearchService } from '../../../core/services/food-search';
import { IdService } from '../../../core/services/id';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator';
import { UiButton } from '../ui-button/ui-button';
import { UiChip } from '../ui-chip/ui-chip';
import { UiEmptyState } from '../ui-empty-state/ui-empty-state';
import { IconName } from '../ui-icon/icon-registry';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';
import { UiSpinner } from '../ui-spinner/ui-spinner';
import { UiTextInput } from '../ui-text-input/ui-text-input';

export type FoodPickerStep = 'search' | 'new-food' | 'portion';
/** Trin, en forælder kan starte i. `portion` startes kun via `editItem`. */
export type FoodPickerStartStep = Exclude<FoodPickerStep, 'portion'>;
export type FoodPickerCtaVerb = 'Tilføj' | 'Gem';

/** Resultatet af et valg: varen med makroer skaleret til `amount` `unit`. */
export interface FoodPickerSelection {
  item: FoodItem;
  amount: number;
  unit: string;
}

/** Enheder i "Ny egen vare" – designets `nfUnits`. */
type FoodUnitId = 'g' | 'stk' | 'portion';

interface FoodUnitOption {
  readonly id: FoodUnitId;
  readonly label: string;
}

interface NewFoodForm {
  name: FormControl<string>;
  amount: FormControl<number | null>;
  unit: FormControl<FoodUnitId>;
  kcal: FormControl<number | null>;
  protein: FormControl<number | null>;
  carbs: FormControl<number | null>;
  fat: FormControl<number | null>;
}

interface PortionStat {
  readonly label: string;
  readonly value: number;
  readonly accent: boolean;
}

type SearchState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly results: readonly FoodItem[] };

const SEARCHING: SearchState = { status: 'loading' };
const EMPTY_RESULTS: readonly FoodItem[] = [];
const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const FOOD_UNITS: readonly FoodUnitOption[] = [
  { id: 'g', label: 'g' },
  { id: 'stk', label: 'stk' },
  { id: 'portion', label: 'port.' },
];
const DEFAULT_FOOD_UNIT: FoodUnitId = 'g';
/** Mængde, når feltet "Portion" står tomt (designets `parseFloat(nfAmt) || 1`). */
const DEFAULT_NEW_FOOD_AMOUNT = 1;

/** Trin for −/+ og træk: 5 for gram, ellers 1 (designets `pickStep`). */
const GRAM_STEP = 5;
const PIECE_STEP = 1;
/** Piksler pr. trin, når tallet trækkes til siden (designets `pickDragMove`). */
const DRAG_PX_PER_STEP = 8;
/** Hurtigvalg for stykvarer (designets `pickChipVals`). */
const PIECE_CHIP_VALUES: readonly number[] = [1, 2, 3, 4];
/** Hurtigvalg for gram: ½, 1×, 2× og 3× standardportionen. */
const GRAM_CHIP_MULTIPLIERS: readonly number[] = [2, 3];
const HALF = 2;

const ID_PREFIX = 'food';
const MORE_LABEL = {
  collapsed: 'Flere detaljer (kulhydrat, fedt)',
  expanded: 'Skjul kulhydrat og fedt',
} as const;
const MORE_ICON: Readonly<Record<'collapsed' | 'expanded', IconName>> = {
  collapsed: 'plus',
  expanded: 'minus',
};
const CREATE_LABEL = {
  blank: 'Opret en vare selv',
  named: (query: string) => `Opret "${query}" som ny vare`,
} as const;
const STAT_LABEL = { kcal: 'kcal', protein: 'protein', carbs: 'kulhydrat', fat: 'fedt' } as const;

interface DragState {
  readonly startX: number;
  readonly startAmount: number;
}

/** `Validators.required` godtager mellemrum – designet kræver et navn med indhold. */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { blank: true } : null;
}

/**
 * Vare-vælgeren fra "Tilføj mad" (designets `addFoodsOpen` / `newFoodOpen` / `pickOpen`):
 * søg → vælg portion, eller opret en egen vare. Komponenten ejer trinnet og annoncerer det
 * i `currentStep` (og med `stepChange` ved skift), så forælderen kan skjule måltidsvalg og
 * faner uden for søgetrinnet.
 *
 * Søgningen går gennem `FoodSearchService`; skalering og portionsparsing gennem
 * `NutritionCalculator`. Makroerne i `picked.item` er allerede skaleret, og `quantity` er
 * `${amount} ${unit}`, så forælderen kan logge varen direkte.
 */
@Component({
  selector: 'app-food-picker',
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiChip,
    UiEmptyState,
    UiIcon,
    UiIconButton,
    UiSpinner,
    UiTextInput,
  ],
  templateUrl: './food-picker.html',
  styleUrl: './food-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'food-picker' },
})
export class FoodPicker {
  /** Forudfyldt søgetekst. */
  readonly initialQuery = input('');
  /** Start i søgningen eller direkte i "Ny egen vare" (scannerens "Varen har ingen stregkode"). */
  readonly startStep = input<FoodPickerStartStep>('search');
  /** Redigér en allerede logget vare: starter i portionstrinnet med varens egen mængde. */
  readonly editItem = input<FoodItem | null>(null);
  readonly ctaVerb = input<FoodPickerCtaVerb>('Tilføj');
  /** Primær knap i "Ny egen vare", fx `'Gem og log under morgenmad'`. */
  readonly saveAndLogLabel = input.required<string>();
  readonly showScan = input(true, { transform: booleanAttribute });

  readonly picked = output<FoodPickerSelection>();
  /** Ny egen vare – både ved "Gem uden at logge" og "Gem og log …" (her følger `picked` efter). */
  readonly customFoodCreated = output<FoodItem>();
  readonly scanRequested = output<void>();
  readonly stepChange = output<FoodPickerStep>();
  /** Tilbage fra portionstrinnet, når der ikke er en søgning at vende tilbage til (redigering). */
  readonly cancelled = output<void>();

  private readonly foodSearch = inject(FoodSearchService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly ids = inject(IdService);

  protected readonly step = linkedSignal<FoodPickerStep>(() =>
    this.editItem() ? 'portion' : this.startStep(),
  );
  /**
   * Trinnet, vælgeren står på – også det første. `stepChange` udsendes kun ved skift, så en
   * forælder, der skal kende trinnet fra start, læser dette signal i stedet for at gætte.
   */
  readonly currentStep: Signal<FoodPickerStep> = this.step.asReadonly();

  // --- Søgning -----------------------------------------------------------------------------

  protected readonly queryControl = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.queryControl.valueChanges, { initialValue: '' });
  /** Tæller op, når resultaterne skal hentes igen med samme søgetekst (ny egen vare gemt). */
  private readonly searchVersion = signal(0);
  private readonly searchRequest = computed(
    () => ({ query: this.query(), version: this.searchVersion() }),
    { equal: (a, b) => a.query === b.query && a.version === b.version },
  );
  private readonly searchState = toSignal(
    toObservable(this.searchRequest).pipe(
      switchMap(({ query }) =>
        concat(
          of(SEARCHING),
          this.foodSearch
            .search(query)
            .pipe(map((results): SearchState => ({ status: 'ready', results }))),
        ),
      ),
    ),
    { initialValue: SEARCHING },
  );

  protected readonly isSearching = computed(() => this.searchState().status === 'loading');
  protected readonly results = computed(() => {
    const state = this.searchState();
    return state.status === 'ready' ? state.results : EMPTY_RESULTS;
  });
  protected readonly hasNoMatches = computed(
    () => !this.isSearching() && this.results().length === 0,
  );
  protected readonly createLabel = computed(() => {
    const query = this.query().trim();
    return query === '' ? CREATE_LABEL.blank : CREATE_LABEL.named(query);
  });

  // --- Ny egen vare ------------------------------------------------------------------------

  protected readonly units = FOOD_UNITS;
  protected readonly form = new FormGroup<NewFoodForm>({
    name: new FormControl('', { nonNullable: true, validators: [notBlank] }),
    amount: new FormControl<number | null>(null),
    unit: new FormControl<FoodUnitId>(DEFAULT_FOOD_UNIT, { nonNullable: true }),
    kcal: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    protein: new FormControl<number | null>(null),
    carbs: new FormControl<number | null>(null),
    fat: new FormControl<number | null>(null),
  });
  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  protected readonly canSaveNewFood = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.valid)),
    { initialValue: this.form.valid },
  );
  protected readonly selectedUnit = computed(() => this.formValue().unit);
  protected readonly showMore = signal(false);
  protected readonly moreLabel = computed(() =>
    this.showMore() ? MORE_LABEL.expanded : MORE_LABEL.collapsed,
  );
  protected readonly moreIcon = computed(() =>
    this.showMore() ? MORE_ICON.expanded : MORE_ICON.collapsed,
  );

  // --- Portion -----------------------------------------------------------------------------

  protected readonly portionItem = linkedSignal<FoodItem | null>(() => this.editItem());
  private readonly baseQuantity = computed(() =>
    this.calculator.parseQuantity(this.portionItem()?.quantity ?? ''),
  );
  protected readonly unit = computed(() => this.baseQuantity().unit);
  private readonly baseAmount = computed(() => this.baseQuantity().amount);
  private readonly amountStep = computed(() =>
    this.unit() === DEFAULT_QUANTITY_UNIT ? GRAM_STEP : PIECE_STEP,
  );
  /**
   * Valgt mængde. `null` = feltet er tømt under indtastning. Nulstilles til
   * standardportionen, hver gang der vælges en ny vare (kilden er selve varen).
   */
  protected readonly amount = linkedSignal<FoodItem | null, number | null>({
    source: this.portionItem,
    computation: (item) => this.calculator.parseQuantity(item?.quantity ?? '').amount,
  });
  protected readonly amountValue = computed(() => {
    const amount = this.amount();
    return amount == null ? '' : String(amount);
  });
  protected readonly portionName = computed(() => this.portionItem()?.name ?? '');
  protected readonly baseLabel = computed(() => {
    const item = this.portionItem();
    return item ? `${item.quantity} · ${item.kcal} kcal` : '';
  });
  private readonly ratio = computed(() => (this.amount() ?? 0) / this.baseAmount());
  protected readonly scaled = computed<Macros>(() => {
    const item = this.portionItem();
    return item ? this.calculator.scaleMacros(item, this.ratio()) : EMPTY_MACROS;
  });
  protected readonly stats = computed<readonly PortionStat[]>(() => {
    const macros = this.scaled();
    return [
      { label: STAT_LABEL.kcal, value: macros.kcal, accent: true },
      { label: STAT_LABEL.protein, value: macros.protein, accent: false },
      { label: STAT_LABEL.carbs, value: macros.carbs, accent: false },
      { label: STAT_LABEL.fat, value: macros.fat, accent: false },
    ];
  });
  protected readonly chipValues = computed<readonly number[]>(() => {
    if (this.unit() !== DEFAULT_QUANTITY_UNIT) {
      return PIECE_CHIP_VALUES;
    }
    const base = this.baseAmount();
    const half = Math.round(base / HALF / GRAM_STEP) * GRAM_STEP || GRAM_STEP;
    return [half, base, ...GRAM_CHIP_MULTIPLIERS.map((factor) => base * factor)];
  });
  protected readonly ctaLabel = computed(
    () => `${this.ctaVerb()} ${this.amount() ?? ''} ${this.unit()}`,
  );
  protected readonly canConfirm = computed(() => (this.amount() ?? 0) > 0);
  protected readonly dragging = signal(false);

  private drag: DragState | null = null;

  constructor() {
    effect(() => {
      this.queryControl.setValue(this.initialQuery());
    });
  }

  // --- Søgning -----------------------------------------------------------------------------

  protected pick(item: FoodItem): void {
    this.portionItem.set(item);
    this.goTo('portion');
  }

  protected requestScan(): void {
    this.scanRequested.emit();
  }

  protected openNewFood(): void {
    this.form.reset({
      name: this.query().trim(),
      amount: null,
      unit: DEFAULT_FOOD_UNIT,
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
    });
    this.showMore.set(false);
    this.goTo('new-food');
  }

  // --- Ny egen vare ------------------------------------------------------------------------

  protected closeNewFood(): void {
    this.goTo('search');
  }

  protected selectUnit(unit: FoodUnitId): void {
    this.form.controls.unit.setValue(unit);
  }

  protected toggleMore(): void {
    this.showMore.update((shown) => !shown);
  }

  protected saveNewFood(): void {
    const item = this.buildCustomFood();
    if (!item) {
      return;
    }
    this.customFoodCreated.emit(item);
    this.finishNewFood();
  }

  protected saveNewFoodAndLog(): void {
    const item = this.buildCustomFood();
    if (!item) {
      return;
    }
    this.customFoodCreated.emit(item);
    const { amount, unit } = this.calculator.parseQuantity(item.quantity);
    this.picked.emit({ item, amount, unit });
    this.finishNewFood();
  }

  // --- Portion -----------------------------------------------------------------------------

  protected backFromPortion(): void {
    if (this.editItem()) {
      this.cancelled.emit();
      return;
    }
    this.portionItem.set(null);
    this.goTo('search');
  }

  protected decrease(): void {
    const step = this.amountStep();
    this.amount.set(Math.max(step, (this.amount() || step) - step));
  }

  protected increase(): void {
    this.amount.set((this.amount() ?? 0) + this.amountStep());
  }

  protected setAmount(value: number): void {
    this.amount.set(value);
  }

  protected onAmountInput(rawValue: string): void {
    const parsed = Number.parseFloat(rawValue);
    this.amount.set(Number.isNaN(parsed) ? null : Math.max(0, parsed));
  }

  protected onDragStart(event: PointerEvent, box: HTMLElement): void {
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    box.setPointerCapture(event.pointerId);
    this.drag = { startX: event.clientX, startAmount: this.amount() ?? 0 };
    this.dragging.set(true);
  }

  protected onDragMove(event: PointerEvent): void {
    if (!this.drag) {
      return;
    }
    const step = this.amountStep();
    const steps = Math.round((event.clientX - this.drag.startX) / DRAG_PX_PER_STEP);
    this.amount.set(Math.max(step, this.drag.startAmount + steps * step));
  }

  protected onDragEnd(event: PointerEvent, box: HTMLElement): void {
    if (!this.drag) {
      return;
    }
    this.drag = null;
    if (box.hasPointerCapture(event.pointerId)) {
      box.releasePointerCapture(event.pointerId);
    }
    this.dragging.set(false);
  }

  protected confirm(): void {
    const item = this.portionItem();
    const amount = this.amount();
    if (!item || amount == null || amount <= 0) {
      return;
    }
    const unit = this.unit();
    this.picked.emit({
      item: { ...item, ...this.scaled(), quantity: `${amount} ${unit}` },
      amount,
      unit,
    });
    if (!this.editItem()) {
      this.portionItem.set(null);
      this.queryControl.setValue('');
      this.goTo('search');
    }
  }

  // --- Fælles ------------------------------------------------------------------------------

  private goTo(step: FoodPickerStep): void {
    if (this.step() === step) {
      return;
    }
    this.step.set(step);
    this.stepChange.emit(step);
  }

  /** Efter en gemt egen vare: tilbage til en tom søgning, der henter resultaterne igen. */
  private finishNewFood(): void {
    this.queryControl.setValue('');
    this.searchVersion.update((version) => version + 1);
    this.goTo('search');
  }

  /** Designets `ownFood`: navn og kalorier er krævet, resten rundes (tomt = 0). */
  private buildCustomFood(): FoodItem | null {
    const value = this.form.getRawValue();
    const name = value.name.trim();
    const kcal = Math.round(value.kcal ?? 0);
    if (name === '' || kcal <= 0) {
      return null;
    }
    const amount =
      value.amount != null && value.amount > 0 ? value.amount : DEFAULT_NEW_FOOD_AMOUNT;
    return {
      id: this.ids.next(ID_PREFIX),
      name,
      quantity: `${amount} ${value.unit}`,
      kcal,
      protein: Math.round(value.protein ?? 0),
      carbs: Math.round(value.carbs ?? 0),
      fat: Math.round(value.fat ?? 0),
      isCustom: true,
    };
  }
}
