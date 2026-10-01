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
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { newId } from '../../../core/utils/id';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { map, switchMap } from 'rxjs';
import { PRODUCT_BASE_UNIT } from '../../../core/constants/barcode';
import {
  FOOD_LOG_MAX_KCAL,
  FOOD_LOG_MAX_MACRO_GRAMS,
  FOOD_NAME_MAX_LENGTH,
  MAX_KCAL_PER_100_GRAMS,
  exceedsFoodLogCap,
} from '../../../core/constants/food';
import { DEFAULT_QUANTITY_UNIT } from '../../../core/constants/nutrition';
import { FoodItem, Macros } from '../../../core/models/food';
import { CUSTOM_FOOD_ID_PREFIX, FoodLogService } from '../../../core/services/food-log/food-log';
import { FoodSearchService } from '../../../core/services/food-search/food-search';
import { injectTranslate } from '../../../core/services/language/translate';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator/nutrition-calculator';
import { normalizeName } from '../../../core/utils/name';
import { UiFormError } from '../ui-form-error/ui-form-error';
import { UiButton } from '../ui-button/ui-button';
import { UiChip } from '../ui-chip/ui-chip';
import { UiEmptyState } from '../ui-empty-state/ui-empty-state';
import { IconName } from '../ui-icon/icon-registry';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';
import { UiTextInput } from '../ui-text-input/ui-text-input';

export type FoodPickerStep = 'search' | 'new-food' | 'portion';
/** Step a parent can start on. `portion` is only started via `editItem`. */
export type FoodPickerStartStep = Exclude<FoodPickerStep, 'portion'>;
/** Identifies the portion step's button text (see `CTA_LABEL_KEY`); not shown as-is. */
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
  readonly labelKey: string;
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

const EMPTY_RESULTS: readonly FoodItem[] = [];
const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const FOOD_UNITS: readonly FoodUnitOption[] = [
  { id: 'g', labelKey: 'common.unit.g' },
  { id: 'stk', labelKey: 'shared.foodPicker.unit.piece' },
  { id: 'portion', labelKey: 'shared.foodPicker.unit.portion' },
];
const DEFAULT_FOOD_UNIT: FoodUnitId = 'g';
/** Amount when the "Portion" field is left empty (design's `parseFloat(nfAmt) || 1`) – also the least one. */
const DEFAULT_NEW_FOOD_AMOUNT = 1;
const PER_100 = 100;

/** Units measured like grams (5-steps, chips from the base portion); any other unit is counted. */
const MEASURED_UNITS: readonly string[] = [DEFAULT_QUANTITY_UNIT, PRODUCT_BASE_UNIT.MILLILITRES];
/** Step for −/+ and drag: 5 for grams and ml, otherwise 1 (design's `pickStep`). */
const GRAM_STEP = 5;
const PIECE_STEP = 1;
/** Pixels per step when the number is dragged sideways (design's `pickDragMove`). */
const DRAG_PX_PER_STEP = 8;
/** Quick picks for piece-based items (design's `pickChipVals`). */
const PIECE_CHIP_VALUES: readonly number[] = [1, 2, 3, 4];
/** Quick picks for grams: ½, 1×, 2× and 3× the default portion. */
const GRAM_CHIP_MULTIPLIERS: readonly number[] = [2, 3];
const HALF = 2;

const MORE_LABEL_KEY = {
  collapsed: 'shared.foodPicker.moreCollapsed',
  expanded: 'shared.foodPicker.moreExpanded',
} as const;
const MORE_ICON: Readonly<Record<'collapsed' | 'expanded', IconName>> = {
  collapsed: 'plus',
  expanded: 'minus',
};
const CREATE_LABEL_KEY = {
  blank: 'shared.foodPicker.createBlank',
  /** Params: `query`. */
  named: 'shared.foodPicker.createNamed',
} as const;
/** Before a search the list is the user's own foods, so "nothing matches" would be wrong. */
const EMPTY_MESSAGE_KEY = {
  blank: 'shared.foodPicker.emptyBlank',
  noMatches: 'shared.foodPicker.emptyNoMatches',
} as const;
const DUPLICATE_NAME_ERROR_KEY = 'shared.foodPicker.duplicateName';
const MACRO_ERROR_KEY = 'shared.foodPicker.macroError';
const KCAL_ERROR_KEY = 'shared.foodPicker.kcalError';
const VALUE_TOO_LARGE_KEY = 'shared.foodPicker.valueTooLarge';
/** The portion would overflow one log (`FOOD_LOG_MAX_KCAL` / `FOOD_LOG_MAX_MACRO_GRAMS`). */
const AMOUNT_TOO_LARGE_KEY = 'shared.foodPicker.amountTooLarge';
const STAT_LABEL_KEY = {
  kcal: 'common.unit.kcal',
  protein: 'shared.foodPicker.stat.protein',
  carbs: 'shared.foodPicker.stat.carbs',
  fat: 'shared.foodPicker.stat.fat',
} as const;
/**
 * The portion step's button text per verb – one full phrase each, so word order can change.
 * Params: `amount`, `unit`.
 */
const CTA_LABEL_KEY: Readonly<Record<FoodPickerCtaVerb, string>> = {
  Tilføj: 'shared.foodPicker.ctaAdd',
  Gem: 'shared.foodPicker.ctaSave',
};

interface DragState {
  readonly startX: number;
  readonly startAmount: number;
}

/**
 * The upper bounds keep the food's per-100 values and one log of its portion inside the API's
 * `numeric(7,2)` (otherwise a 500).
 */
function macroControl(): FormControl<number | null> {
  return new FormControl<number | null>(null, [
    nonNegative,
    Validators.max(FOOD_LOG_MAX_MACRO_GRAMS),
  ]);
}

/** A portion in grams can't hold more than 900 kcal per 100 g, nor more macros than it weighs. */
function plausibleForGrams(group: AbstractControl): ValidationErrors | null {
  const { amount, unit, kcal, protein, carbs, fat } = (
    group as FormGroup<NewFoodForm>
  ).getRawValue();
  const grams = amount ?? DEFAULT_NEW_FOOD_AMOUNT;
  // Too small an amount is the amount field's own `min` error.
  if (unit !== DEFAULT_QUANTITY_UNIT || grams < DEFAULT_NEW_FOOD_AMOUNT) {
    return null;
  }
  const tooMuch =
    ((kcal ?? 0) * PER_100) / grams > MAX_KCAL_PER_100_GRAMS ||
    (protein ?? 0) + (carbs ?? 0) + (fat ?? 0) > grams;
  return tooMuch ? { tooLarge: true } : null;
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
 * `${amount} ${unit}`, so the parent can log the item directly. After `picked` the step stays
 * put – both parents close the picker once the pick is saved, and `busy` covers the wait.
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
    UiTextInput,
    TranslatePipe,
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
  /** Edit an already logged item: starts on the portion step, and only the amount can change (spec 3.3). */
  readonly editItem = input<FoodItem | null>(null);
  readonly ctaVerb = input<FoodPickerCtaVerb>('Tilføj');
  /** Primary button on "New custom item", e.g. `'Save and log under breakfast'`. */
  readonly saveAndLogLabel = input.required<string>();
  readonly showScan = input(true, { transform: booleanAttribute });
  /** The parent is saving the pick: the primary buttons show a spinner and block further taps. */
  readonly busy = input(false, { transform: booleanAttribute });

  /** A portion – or "Save and log …", whose new food the parent creates via `FoodLogService.ensureFood`. */
  readonly picked = output<FoodPickerSelection>();
  /** New custom item from "Save without logging". */
  readonly customFoodCreated = output<FoodItem>();
  readonly scanRequested = output<void>();
  readonly stepChange = output<FoodPickerStep>();
  /** Back from the portion step when there's no search to return to (editing). */
  readonly cancelled = output<void>();

  private readonly foodSearch = inject(FoodSearchService);
  private readonly foodLog = inject(FoodLogService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly t = injectTranslate();

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
  /** Searches again when the text or the catalogue changes (e.g. a new custom food was saved). */
  private readonly searchRequest = computed(() => ({
    query: this.query(),
    foods: this.foodLog.foods(),
  }));
  protected readonly results = toSignal(
    toObservable(this.searchRequest).pipe(switchMap(({ query }) => this.foodSearch.search(query))),
    { initialValue: EMPTY_RESULTS },
  );
  protected readonly hasNoMatches = computed(() => this.results().length === 0);
  protected readonly emptyMessage = computed(() =>
    this.t(this.query().trim() === '' ? EMPTY_MESSAGE_KEY.blank : EMPTY_MESSAGE_KEY.noMatches),
  );
  protected readonly createLabel = computed(() => {
    const query = this.query().trim();
    return query === ''
      ? this.t(CREATE_LABEL_KEY.blank)
      : this.t(CREATE_LABEL_KEY.named, { query });
  });

  // --- New custom item -------------------------------------------------------------------

  protected readonly units = FOOD_UNITS;
  protected readonly nameMaxLength = FOOD_NAME_MAX_LENGTH;
  protected readonly form = new FormGroup<NewFoodForm>(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [notBlank, Validators.maxLength(FOOD_NAME_MAX_LENGTH)],
      }),
      amount: new FormControl<number | null>(null, [Validators.min(DEFAULT_NEW_FOOD_AMOUNT)]),
      unit: new FormControl<FoodUnitId>(DEFAULT_FOOD_UNIT, { nonNullable: true }),
      kcal: new FormControl<number | null>(null, [
        Validators.required,
        Validators.min(1),
        Validators.max(FOOD_LOG_MAX_KCAL),
      ]),
      protein: macroControl(),
      carbs: macroControl(),
      fat: macroControl(),
    },
    { validators: [plausibleForGrams] },
  );
  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  private readonly formValid = toSignal(this.form.statusChanges.pipe(map(() => this.form.valid)), {
    initialValue: this.form.valid,
  });
  /**
   * The new food last sent to the parent, until the form changes. Its name isn't "taken": an
   * unchanged save that failed after the food was created can be retried (`ensureFood` /
   * `addCustomFood` reuse it by name – so a changed form must not be exempt, or the first values
   * would be logged). After "Save without logging" (`leave`) the form stays until the food is in
   * the catalogue with its unit, so a failed save keeps what was typed.
   */
  private readonly submitted = signal<{ readonly item: FoodItem; readonly leave: boolean } | null>(
    null,
  );
  /** Case-insensitive, trimmed match against the user's own foods. */
  protected readonly nameError = computed(() => {
    const name = normalizeName(this.formValue().name);
    const retry = name === normalizeName(this.submitted()?.item.name ?? '');
    return !retry && this.foodLog.hasCustomFoodNamed(name)
      ? this.t(DUPLICATE_NAME_ERROR_KEY)
      : null;
  });
  protected readonly nameInvalid = computed(() => this.nameError() !== null);
  protected readonly canSaveNewFood = computed(() => this.formValid() && !this.nameInvalid());
  /** One line for the number fields: a negative macro, too few kcal or a value that's too large. */
  protected readonly valueError = computed(() => {
    this.formValue(); // the control errors below are current whenever the value changes
    const { kcal, protein, carbs, fat } = this.form.controls;
    const macros = [protein, carbs, fat];
    if (macros.some((control) => control.hasError('nonNegative'))) {
      return this.t(MACRO_ERROR_KEY);
    }
    if (kcal.hasError('min')) {
      return this.t(KCAL_ERROR_KEY);
    }
    return [kcal, ...macros].some((control) => control.hasError('max')) ||
      this.form.hasError('tooLarge')
      ? this.t(VALUE_TOO_LARGE_KEY)
      : null;
  });
  protected readonly selectedUnit = computed(() => this.formValue().unit);
  protected readonly showMore = signal(false);
  protected readonly moreLabel = computed(() =>
    this.t(this.showMore() ? MORE_LABEL_KEY.expanded : MORE_LABEL_KEY.collapsed),
  );
  protected readonly moreIcon = computed(() =>
    this.showMore() ? MORE_ICON.expanded : MORE_ICON.collapsed,
  );

  // --- Portion -------------------------------------------------------------------------------

  protected readonly portionItem = linkedSignal<FoodItem | null>(() => this.editItem());
  private readonly baseQuantity = computed(() =>
    this.calculator.parseQuantity(this.portionItem()?.quantity ?? ''),
  );
  protected readonly unit = computed(() => this.baseQuantity().unit);
  private readonly baseAmount = computed(() => this.baseQuantity().amount);
  private readonly measured = computed(() => MEASURED_UNITS.includes(this.unit()));
  private readonly amountStep = computed(() => (this.measured() ? GRAM_STEP : PIECE_STEP));
  /**
   * The selected amount. `null` = the field is cleared while typing. Resets to the default
   * portion every time a new item is selected (the source is the item itself).
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
    return item
      ? this.t('shared.foodPicker.baseLabel', {
          quantity: item.quantity,
          // A logged row being edited has the API's exact values.
          kcal: Math.round(item.kcal),
        })
      : '';
  });
  private readonly ratio = computed(() => (this.amount() ?? 0) / this.baseAmount());
  protected readonly scaled = computed<Macros>(() => {
    const item = this.portionItem();
    return item ? this.calculator.scaleMacros(item, this.ratio()) : EMPTY_MACROS;
  });
  /** Spec 3.2-5a: one log may not overflow the API's `numeric(7,2)` – split it up instead. */
  private readonly exceedsLogCap = computed(() => exceedsFoodLogCap(this.scaled()));
  protected readonly amountError = computed(() =>
    this.exceedsLogCap() ? this.t(AMOUNT_TOO_LARGE_KEY) : null,
  );
  protected readonly stats = computed<readonly PortionStat[]>(() => {
    const macros = this.scaled();
    return [
      { label: this.t(STAT_LABEL_KEY.kcal), value: macros.kcal, accent: true },
      { label: this.t(STAT_LABEL_KEY.protein), value: macros.protein, accent: false },
      { label: this.t(STAT_LABEL_KEY.carbs), value: macros.carbs, accent: false },
      { label: this.t(STAT_LABEL_KEY.fat), value: macros.fat, accent: false },
    ];
  });
  protected readonly chipValues = computed<readonly number[]>(() => {
    if (!this.measured()) {
      return PIECE_CHIP_VALUES;
    }
    const base = this.baseAmount();
    const half = Math.round(base / HALF / GRAM_STEP) * GRAM_STEP || GRAM_STEP;
    return [half, base, ...GRAM_CHIP_MULTIPLIERS.map((factor) => base * factor)];
  });
  protected readonly ctaLabel = computed(() =>
    this.t(CTA_LABEL_KEY[this.ctaVerb()], {
      amount: String(this.amount() ?? ''),
      unit: this.unit(),
    }),
  );
  protected readonly canConfirm = computed(() => (this.amount() ?? 0) > 0 && !this.exceedsLogCap());
  protected readonly dragging = signal(false);

  private drag: DragState | null = null;

  constructor() {
    effect(() => {
      this.queryControl.setValue(this.initialQuery());
    });
    // Only an unchanged form is a retry of the food already sent (see `submitted`).
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.submitted.set(null));
    effect(() => {
      const submitted = this.submitted();
      if (submitted?.leave && this.step() === 'new-food' && this.isSaved(submitted.item)) {
        untracked(() => this.finishNewFood());
      }
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
    this.submitted.set(null);
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

  /** Pessimistic: the form is left once the parent has saved the food (see `submitted`). */
  protected saveNewFood(): void {
    const item = this.buildCustomFood();
    if (!item || this.busy()) {
      return;
    }
    this.submitted.set({ item, leave: true });
    this.customFoodCreated.emit(item);
  }

  /**
   * Only `picked`: the parent's `FoodLogService.add()` creates the food before it logs it (no
   * race between the two). The form stays until the parent closes the picker, so a failed save
   * keeps what was typed.
   */
  protected saveNewFoodAndLog(): void {
    const item = this.buildCustomFood();
    if (!item || this.busy()) {
      return;
    }
    const { amount, unit } = this.calculator.parseQuantity(item.quantity);
    this.submitted.set({ item, leave: false });
    this.picked.emit({ item, amount, unit });
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

  /** Emits the portion. The step stays until the parent closes the picker (a failed save can be retried). */
  protected confirm(): void {
    const item = this.portionItem();
    const amount = this.amount();
    if (!item || amount == null || !this.canConfirm() || this.busy()) {
      return;
    }
    const unit = this.unit();
    this.picked.emit({
      item: { ...item, ...this.scaled(), quantity: `${amount} ${unit}` },
      amount,
      unit,
    });
  }

  // --- Shared --------------------------------------------------------------------------------

  private goTo(step: FoodPickerStep): void {
    if (this.step() === step) {
      return;
    }
    this.step.set(step);
    this.stepChange.emit(step);
  }

  /**
   * The catalogue has the food under its name and in its unit. A food whose serving failed shows
   * as `100 g`, so the form stays and the same save can heal it.
   */
  private isSaved(item: FoodItem): boolean {
    const name = normalizeName(item.name);
    const { unit } = this.calculator.parseQuantity(item.quantity);
    return this.foodLog
      .customFoods()
      .some(
        (food) =>
          normalizeName(food.name) === name &&
          this.calculator.parseQuantity(food.quantity).unit === unit,
      );
  }

  /** After "Save without logging": back to an empty search, where the saved food shows up. */
  private finishNewFood(): void {
    this.submitted.set(null);
    this.queryControl.setValue('');
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
