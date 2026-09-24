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
import { newId } from '../../../core/utils/id';
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
import { CUSTOM_FOOD_ID_PREFIX, FoodLogService } from '../../../core/services/food-log/food-log';
import { FoodSearchService } from '../../../core/services/food-search/food-search';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator/nutrition-calculator';
import { UiFormError } from '../ui-form-error/ui-form-error';
import { UiButton } from '../ui-button/ui-button';
import { UiChip } from '../ui-chip/ui-chip';
import { UiEmptyState } from '../ui-empty-state/ui-empty-state';
import { IconName } from '../ui-icon/icon-registry';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';
import { UiSpinner } from '../ui-spinner/ui-spinner';
import { UiTextInput } from '../ui-text-input/ui-text-input';

export type FoodPickerStep = 'search' | 'new-food' | 'portion';
/** Step a parent can start on. `portion` is only started via `editItem`. */
export type FoodPickerStartStep = Exclude<FoodPickerStep, 'portion'>;
export type FoodPickerCtaVerb = 'Tilføj' | 'Gem';

/** The result of a selection: the item with macros scaled to `amount` `unit`. */
export interface FoodPickerSelection {
  item: FoodItem;
  amount: number;
  unit: string;
}

/** Units in "New custom item" – design's `nfUnits`. */
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

/** The custom food's own nutrition, editable while a logged custom food is edited. */
interface MacroForm {
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
/** Amount when the "Portion" field is left empty (design's `parseFloat(nfAmt) || 1`). */
const DEFAULT_NEW_FOOD_AMOUNT = 1;

/** Step for −/+ and drag: 5 for grams, otherwise 1 (design's `pickStep`). */
const GRAM_STEP = 5;
const PIECE_STEP = 1;
/** Pixels per step when the number is dragged sideways (design's `pickDragMove`). */
const DRAG_PX_PER_STEP = 8;
/** Quick picks for piece-based items (design's `pickChipVals`). */
const PIECE_CHIP_VALUES: readonly number[] = [1, 2, 3, 4];
/** Quick picks for grams: ½, 1×, 2× and 3× the default portion. */
const GRAM_CHIP_MULTIPLIERS: readonly number[] = [2, 3];
const HALF = 2;

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
/** Before a search the list is the user's own foods, so "nothing matches" would be wrong. */
const EMPTY_MESSAGE = {
  blank: 'Du har ingen varer endnu. Søg, scan en stregkode eller opret en selv.',
  noMatches: 'Ingen varer matcher din søgning.',
} as const;
const DUPLICATE_NAME_ERROR = 'Du har allerede en egen vare med det navn.';
const MACRO_ERROR = 'Protein, kulhydrat og fedt skal være 0 eller større.';
const KCAL_ERROR = 'Kalorier skal være mindst 1.';
const STAT_LABEL = { kcal: 'kcal', protein: 'protein', carbs: 'kulhydrat', fat: 'fedt' } as const;

interface DragState {
  readonly startX: number;
  readonly startAmount: number;
}

/** Validators shared by "New custom item" and the macro editing on the portion step. */
function kcalControl(value: number | null): FormControl<number | null> {
  return new FormControl<number | null>(value, [Validators.required, Validators.min(1)]);
}

function macroControl(value: number | null): FormControl<number | null> {
  return new FormControl<number | null>(value, [nonNegative]);
}

function hasNegativeMacro(values: readonly (number | null)[]): boolean {
  return values.some((value) => value !== null && (!Number.isFinite(value) || value < 0));
}

function nonNegative(control: AbstractControl<number | null>): ValidationErrors | null {
  const value = control.value;
  return value === null || (Number.isFinite(value) && value >= 0) ? null : { nonNegative: true };
}

/** `Validators.required` accepts whitespace – the design requires a name with actual content. */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { blank: true } : null;
}

/**
 * The item picker from "Add food" (design's `addFoodsOpen` / `newFoodOpen` / `pickOpen`):
 * search → pick a portion, or create a custom item. The component owns the step and announces
 * it via `currentStep` (and with `stepChange` on change), so the parent can hide the meal
 * selector and tabs outside the search step.
 *
 * Search goes through `FoodSearchService`; scaling and portion parsing through
 * `NutritionCalculator`. The macros in `picked.item` are already scaled, and `quantity` is
 * `${amount} ${unit}`, so the parent can log the item directly.
 */
@Component({
  selector: 'app-food-picker',
  imports: [
    ReactiveFormsModule,
    UiFormError,
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
  /** Pre-filled search text. */
  readonly initialQuery = input('');
  /** Start on the search or directly on "New custom item" (the scanner's "The item has no barcode"). */
  readonly startStep = input<FoodPickerStartStep>('search');
  /** Edit an already logged item: starts on the portion step with the item's own amount. */
  readonly editItem = input<FoodItem | null>(null);
  /**
   * The user's own food that `editItem` was logged from. When set (and custom), the portion
   * step uses it as the base and also lets the user edit its kcal and macros; saving then
   * emits `customFoodEdited` before `picked`. Without it only the amount can be changed.
   */
  readonly editBaseItem = input<FoodItem | null>(null);
  readonly ctaVerb = input<FoodPickerCtaVerb>('Tilføj');
  /** Primary button on "New custom item", e.g. `'Save and log under breakfast'`. */
  readonly saveAndLogLabel = input.required<string>();
  readonly showScan = input(true, { transform: booleanAttribute });

  readonly picked = output<FoodPickerSelection>();
  /** New custom item – both for "Save without logging" and "Save and log …" (here `picked` follows after). */
  readonly customFoodCreated = output<FoodItem>();
  /** The edited custom food (base portion, new macros) – only while editing a custom food. */
  readonly customFoodEdited = output<FoodItem>();
  readonly scanRequested = output<void>();
  readonly stepChange = output<FoodPickerStep>();
  /** Back from the portion step when there's no search to return to (editing). */
  readonly cancelled = output<void>();

  private readonly foodSearch = inject(FoodSearchService);
  private readonly foodLog = inject(FoodLogService);
  private readonly calculator = inject(NutritionCalculator);

  protected readonly step = linkedSignal<FoodPickerStep>(() =>
    this.editItem() ? 'portion' : this.startStep(),
  );
  /**
   * The step the picker is on – including the first one. `stepChange` is only emitted on
   * change, so a parent that needs to know the step from the start reads this signal instead of guessing.
   */
  readonly currentStep: Signal<FoodPickerStep> = this.step.asReadonly();

  // --- Search --------------------------------------------------------------------------------

  protected readonly queryControl = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.queryControl.valueChanges, { initialValue: '' });
  /** Counts up when the results need to be fetched again with the same search text (new custom item saved). */
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
  protected readonly emptyMessage = computed(() =>
    this.query().trim() === '' ? EMPTY_MESSAGE.blank : EMPTY_MESSAGE.noMatches,
  );
  protected readonly createLabel = computed(() => {
    const query = this.query().trim();
    return query === '' ? CREATE_LABEL.blank : CREATE_LABEL.named(query);
  });

  // --- New custom item -------------------------------------------------------------------

  protected readonly units = FOOD_UNITS;
  protected readonly form = new FormGroup<NewFoodForm>({
    name: new FormControl('', { nonNullable: true, validators: [notBlank] }),
    amount: new FormControl<number | null>(null),
    unit: new FormControl<FoodUnitId>(DEFAULT_FOOD_UNIT, { nonNullable: true }),
    kcal: kcalControl(null),
    protein: macroControl(null),
    carbs: macroControl(null),
    fat: macroControl(null),
  });
  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  private readonly formValid = toSignal(this.form.statusChanges.pipe(map(() => this.form.valid)), {
    initialValue: this.form.valid,
  });
  /** Case-insensitive, trimmed match against the user's own foods. */
  protected readonly nameError = computed(() =>
    this.foodLog.hasCustomFoodNamed(this.formValue().name) ? DUPLICATE_NAME_ERROR : null,
  );
  protected readonly nameInvalid = computed(() => this.nameError() !== null);
  protected readonly canSaveNewFood = computed(() => this.formValid() && !this.nameInvalid());
  protected readonly macroError = computed(() => {
    const { protein, carbs, fat } = this.formValue();
    return hasNegativeMacro([protein, carbs, fat]) ? MACRO_ERROR : null;
  });
  protected readonly selectedUnit = computed(() => this.formValue().unit);
  protected readonly showMore = signal(false);
  protected readonly moreLabel = computed(() =>
    this.showMore() ? MORE_LABEL.expanded : MORE_LABEL.collapsed,
  );
  protected readonly moreIcon = computed(() =>
    this.showMore() ? MORE_ICON.expanded : MORE_ICON.collapsed,
  );

  // --- Portion -------------------------------------------------------------------------------

  /** True while a logged custom food is edited – then its kcal and macros can be changed too. */
  protected readonly canEditMacros = computed(
    () => this.editItem() !== null && this.editBaseItem()?.isCustom === true,
  );
  protected readonly portionItem = linkedSignal<FoodItem | null>(() =>
    this.canEditMacros() ? this.editBaseItem() : this.editItem(),
  );
  protected readonly macroForm = new FormGroup<MacroForm>({
    kcal: kcalControl(null),
    protein: macroControl(null),
    carbs: macroControl(null),
    fat: macroControl(null),
  });
  private readonly macroFormValue = toSignal(
    this.macroForm.valueChanges.pipe(map(() => this.macroForm.getRawValue())),
    { initialValue: this.macroForm.getRawValue() },
  );
  private readonly macroFormValid = toSignal(
    this.macroForm.statusChanges.pipe(map(() => this.macroForm.valid)),
    { initialValue: this.macroForm.valid },
  );
  protected readonly editMacroError = computed(() => {
    if (!this.canEditMacros()) {
      return null;
    }
    const { kcal, protein, carbs, fat } = this.macroFormValue();
    if (hasNegativeMacro([protein, carbs, fat])) {
      return MACRO_ERROR;
    }
    return kcal === null || kcal < 1 ? KCAL_ERROR : null;
  });
  /** The base the portion is scaled from: the item, with the edited macros when editing is allowed. */
  private readonly portionBase = computed<FoodItem | null>(() => {
    const item = this.portionItem();
    if (!item || !this.canEditMacros()) {
      return item;
    }
    const { kcal, protein, carbs, fat } = this.macroFormValue();
    return {
      ...item,
      kcal: Math.round(kcal ?? 0),
      protein: Math.round(protein ?? 0),
      carbs: Math.round(carbs ?? 0),
      fat: Math.round(fat ?? 0),
    };
  });
  protected readonly macroBaseLabel = computed(
    () => `Næringsindhold pr. ${this.portionItem()?.quantity ?? ''}`,
  );
  private readonly baseQuantity = computed(() =>
    this.calculator.parseQuantity(this.portionItem()?.quantity ?? ''),
  );
  protected readonly unit = computed(() => this.baseQuantity().unit);
  private readonly baseAmount = computed(() => this.baseQuantity().amount);
  private readonly amountStep = computed(() =>
    this.unit() === DEFAULT_QUANTITY_UNIT ? GRAM_STEP : PIECE_STEP,
  );
  /**
   * The selected amount. `null` = the field is cleared while typing. Resets to the default
   * portion every time a new item is selected (the source is the item itself).
   */
  protected readonly amount = linkedSignal<FoodItem | null, number | null>({
    source: this.portionItem,
    computation: (item) => this.calculator.parseQuantity(this.initialQuantity(item)).amount,
  });
  protected readonly amountValue = computed(() => {
    const amount = this.amount();
    return amount == null ? '' : String(amount);
  });
  protected readonly portionName = computed(() => this.portionItem()?.name ?? '');
  protected readonly baseLabel = computed(() => {
    const item = this.portionBase();
    return item ? `${item.quantity} · ${item.kcal} kcal` : '';
  });
  private readonly ratio = computed(() => (this.amount() ?? 0) / this.baseAmount());
  protected readonly scaled = computed<Macros>(() => {
    const item = this.portionBase();
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
  protected readonly canConfirm = computed(
    () => (this.amount() ?? 0) > 0 && (!this.canEditMacros() || this.macroFormValid()),
  );
  protected readonly dragging = signal(false);

  private drag: DragState | null = null;

  constructor() {
    effect(() => {
      this.queryControl.setValue(this.initialQuery());
    });
    effect(() => {
      const base = this.canEditMacros() ? this.editBaseItem() : null;
      this.macroForm.reset({
        kcal: base?.kcal ?? null,
        protein: base?.protein ?? null,
        carbs: base?.carbs ?? null,
        fat: base?.fat ?? null,
      });
    });
  }

  // --- Search --------------------------------------------------------------------------------

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

  // --- New custom item -------------------------------------------------------------------

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

  // --- Portion -------------------------------------------------------------------------------

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
    const item = this.portionBase();
    const amount = this.amount();
    if (!item || amount == null || !this.canConfirm()) {
      return;
    }
    if (this.canEditMacros()) {
      this.customFoodEdited.emit(item);
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

  // --- Shared --------------------------------------------------------------------------------

  private goTo(step: FoodPickerStep): void {
    if (this.step() === step) {
      return;
    }
    this.step.set(step);
    this.stepChange.emit(step);
  }

  /** When editing from the custom food, the amount starts at the logged entry's amount. */
  private initialQuantity(item: FoodItem | null): string {
    const edited = this.editItem();
    return item !== null && edited !== null && item === this.editBaseItem()
      ? edited.quantity
      : (item?.quantity ?? '');
  }

  /** After a saved custom item: back to an empty search that fetches the results again. */
  private finishNewFood(): void {
    this.queryControl.setValue('');
    this.searchVersion.update((version) => version + 1);
    this.goTo('search');
  }

  /** Design's `ownFood`: name and calories are required, the rest is rounded (empty = 0). */
  private buildCustomFood(): FoodItem | null {
    if (this.form.invalid || this.nameInvalid()) {
      this.form.markAllAsTouched();
      return null;
    }
    const value = this.form.getRawValue();
    const name = value.name.trim();
    const kcal = Math.round(value.kcal ?? 0);
    if (name === '' || kcal <= 0) {
      return null;
    }
    const amount =
      value.amount != null && value.amount > 0 ? value.amount : DEFAULT_NEW_FOOD_AMOUNT;
    return {
      id: newId(CUSTOM_FOOD_ID_PREFIX),
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
