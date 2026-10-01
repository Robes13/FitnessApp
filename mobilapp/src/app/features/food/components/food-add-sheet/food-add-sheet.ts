import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { MEALS } from '../../../../core/constants/meals';
import { FoodCollection, FoodItem, LoggedFood } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { KeyboardService } from '../../../../core/services/keyboard/keyboard';
import { injectTranslate } from '../../../../core/services/language/translate';
import { toApiError } from '../../../../core/utils/api';
import {
  FoodPicker,
  FoodPickerCtaVerb,
  FoodPickerSelection,
  FoodPickerStartStep,
  FoodPickerStep,
} from '../../../../shared/components/food-picker/food-picker';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiChip } from '../../../../shared/components/ui-chip/ui-chip';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import {
  SegmentOption,
  UiSegmentedControl,
} from '../../../../shared/components/ui-segmented-control/ui-segmented-control';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { UiSpinner } from '../../../../shared/components/ui-spinner/ui-spinner';

/** The design's `addTab`: the foods from search or the user's collections. */
export type AddSheetTab = 'varer' | 'samlinger';

const DEFAULT_TAB: AddSheetTab = 'varer';
/** The picker's step until it has traveled (it always starts on search). */
const DEFAULT_PICKER_STEP: FoodPickerStep = 'search';

const TAB_LABEL_KEYS: readonly { readonly value: AddSheetTab; readonly labelKey: string }[] = [
  { value: 'varer', labelKey: 'food.addSheet.tabItems' },
  { value: 'samlinger', labelKey: 'food.addSheet.tabCollections' },
];

/** The design's `addSheetVerb` / `addSheetWhat`. */
const TITLE_KEY = {
  add: 'food.addSheet.titleAdd',
  edit: 'food.addSheet.titleEdit',
  editWhat: 'food.addSheet.titleEditWhat',
} as const;

const CTA_VERB = { add: 'Tilføj', edit: 'Gem' } as const satisfies Record<
  'add' | 'edit',
  FoodPickerCtaVerb
>;

const COLLECTIONS_EMPTY_MESSAGE_KEY = 'food.addSheet.collectionsEmpty';

/** A collection in the "Collections" tab – logged as its items, one row each (P13). */
interface CollectionRowView {
  readonly id: string;
  readonly name: string;
  /** The design's `ac.sub`: the names of the foods in the collection. */
  readonly subtitle: string;
  readonly kcalLabel: string;
}

/**
 * The "Add food" sheet (the design's `addOpen`): meal chips, the Foods/Collections tabs and
 * either `app-food-picker` or the list of collections.
 *
 * The tabs only belong to the search step, while the meal chips also stay put on the portion
 * step. Both are hidden in "New custom food" and when an already logged food is being edited –
 * then the meal is given, and the sheet is called "Edit food".
 *
 * The content sits behind `@if (open())`, so the picker starts over every time the sheet opens.
 * Foods are passed on to the page via `selected`, `customFoodCreated` and `scanRequested`. While
 * the page saves (`busy`) the picker's button shows a spinner, and a failure (`error`) is shown
 * above the content – the sheet stays open, so nothing typed is lost. A collection is logged by
 * the sheet itself (`CollectionsService.log`, one call) and closes it once the API has answered.
 */
@Component({
  selector: 'app-food-add-sheet',
  imports: [
    FoodPicker,
    TranslatePipe,
    UiButton,
    UiChip,
    UiEmptyState,
    UiFormError,
    UiIcon,
    UiSegmentedControl,
    UiSheet,
    UiSpinner,
  ],
  templateUrl: './food-add-sheet.html',
  styleUrl: './food-add-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'food-add-sheet' },
})
export class FoodAddSheet {
  readonly open = input.required<boolean>();
  /** The meal the food is logged under. The sheet changes it itself when the user picks a chip. */
  readonly meal = model.required<MealId>();
  /** Set when an already logged food is being edited: the picker opens directly on the portion step. */
  readonly editEntry = input<LoggedFood | null>(null);
  /** The picker's starting step – the scanner can send the user straight to "New custom food". */
  readonly startStep = input<FoodPickerStartStep>('search');
  /** The page is saving the selection. */
  readonly busy = input(false, { transform: booleanAttribute });
  /** Why the last save failed (translated), or `null`. */
  readonly error = input<string | null>(null);

  readonly closed = output<void>();
  /** A finished food from the picker, ready for the log. */
  readonly selected = output<FoodItem>();
  readonly customFoodCreated = output<FoodItem>();
  readonly scanRequested = output<void>();

  private readonly collections = inject(CollectionsService);
  private readonly t = injectTranslate();
  private readonly keyboardOpen = inject(KeyboardService).isOpen;

  protected readonly mealOptions = MEALS;
  protected readonly tabOptions = computed<readonly SegmentOption<AddSheetTab>[]>(() =>
    TAB_LABEL_KEYS.map(({ value, labelKey }) => ({ value, label: this.t(labelKey) })),
  );
  protected readonly emptyMessageKey = COLLECTIONS_EMPTY_MESSAGE_KEY;
  /** The collections' load state – the tab doesn't claim "no collections" while it isn't known. */
  protected readonly collectionsStatus = this.collections.status;
  /** A collection is being logged – the rows are off. */
  protected readonly logging = signal(false);
  /** Translation key of the last failed collection log; cleared on every open. */
  private readonly logErrorKey = linkedSignal<boolean, string | null>({
    source: this.open,
    computation: () => null,
  });
  /** The page's failure, or else the last failed collection log – shown above the content. */
  protected readonly notice = computed(() => {
    const key = this.logErrorKey();
    return this.error() ?? (key === null ? null : this.t(key));
  });
  /** The page saves or a collection is being logged – the collection rows are off. */
  protected readonly rowsBusy = computed(() => this.busy() || this.logging());

  /** Every open (and close) starts over on the Foods tab. */
  protected readonly tab = linkedSignal<boolean, AddSheetTab>({
    source: this.open,
    computation: () => DEFAULT_TAB,
  });
  /** The picker owns its own step and exposes it via `currentStep`; the sheet doesn't mirror it. */
  private readonly picker = viewChild(FoodPicker);
  protected readonly pickerStep = computed<FoodPickerStep>(
    () => this.picker()?.currentStep() ?? DEFAULT_PICKER_STEP,
  );

  protected readonly isEditing = computed(() => this.editEntry() !== null);
  protected readonly title = computed(() =>
    this.t(this.isEditing() ? TITLE_KEY.edit : TITLE_KEY.add),
  );
  protected readonly titleAccent = computed(() =>
    this.isEditing() ? this.t(TITLE_KEY.editWhat) : this.mealLabel().toLowerCase(),
  );
  protected readonly ctaVerb = computed<FoodPickerCtaVerb>(() =>
    this.isEditing() ? CTA_VERB.edit : CTA_VERB.add,
  );
  protected readonly saveAndLogLabel = computed(() =>
    this.t('food.addSheet.saveAndLog', { mealName: this.mealLabel().toLowerCase() }),
  );

  /**
   * The design's `showMealPicks`: the chips stay put on the portion step, so the meal can be
   * changed right before the food is logged. They only disappear in "New custom food" and while editing
   * – and while the on-screen keyboard is open, so a short phone keeps room for the search field.
   */
  protected readonly showMealPicks = computed(
    () => !this.isEditing() && this.pickerStep() !== 'new-food' && !this.keyboardOpen(),
  );
  /** The design's `addTabsVisible`: the tabs only belong to the search step (and hide above the keyboard). */
  protected readonly showTabs = computed(
    () => !this.isEditing() && this.pickerStep() === 'search' && !this.keyboardOpen(),
  );
  /** Editing always goes through the picker, regardless of which tab was last selected. */
  protected readonly showPicker = computed(() => this.isEditing() || this.tab() === 'varer');

  protected readonly collectionRows = computed<readonly CollectionRowView[]>(() =>
    this.collections.collections().map((collection) => this.toRow(collection)),
  );

  protected retryCollections(): void {
    this.collections.load().subscribe();
  }

  protected onTabChange(tab: AddSheetTab | null): void {
    this.tab.set(tab ?? DEFAULT_TAB);
  }

  protected onPicked(selection: FoodPickerSelection): void {
    this.selected.emit(selection.item);
  }

  /** One API call logs every item under the chosen meal (P13); the sheet closes on success. */
  protected onCollectionPicked(row: CollectionRowView): void {
    if (this.rowsBusy()) {
      return;
    }
    this.logging.set(true);
    this.logErrorKey.set(null);
    this.collections
      .log(row.id, this.meal())
      .pipe(finalize(() => this.logging.set(false)))
      .subscribe({
        next: () => this.closed.emit(),
        error: (error: unknown) => this.logErrorKey.set(toApiError(error).messageKey),
      });
  }

  private mealLabel(): string {
    const id = this.meal();
    const meal = MEALS.find((candidate) => candidate.id === id);
    return meal ? this.t(meal.labelKey) : '';
  }

  /** A collection always has 1–50 items (the API's rule). */
  private toRow(collection: FoodCollection): CollectionRowView {
    const totals = this.collections.collectionTotals(collection);
    return {
      id: collection.id,
      name: collection.name,
      subtitle: collection.items.map((item) => item.name).join(', '),
      kcalLabel: `${Math.round(totals.kcal)} ${this.t('common.unit.kcal')}`,
    };
  }
}
