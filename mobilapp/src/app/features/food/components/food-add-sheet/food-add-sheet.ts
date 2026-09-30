import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CollectionIconName } from '../../../../core/constants/collection-icons';
import { MEALS, MEAL_TONES } from '../../../../core/constants/meals';
import { FoodCollection, FoodItem, LoggedFood } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import { KeyboardService } from '../../../../core/services/keyboard/keyboard';
import { injectTranslate } from '../../../../core/services/language/translate';
import {
  FoodPicker,
  FoodPickerCtaVerb,
  FoodPickerSelection,
  FoodPickerStartStep,
  FoodPickerStep,
} from '../../../../shared/components/food-picker/food-picker';
import { UiChip } from '../../../../shared/components/ui-chip/ui-chip';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import {
  SegmentOption,
  UiSegmentedControl,
} from '../../../../shared/components/ui-segmented-control/ui-segmented-control';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';

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

/** A collection in the "Collections" tab – the whole collection is logged as one food. */
interface CollectionRowView {
  readonly id: string;
  readonly name: string;
  /** The design's `ac.sub`: the names of the dishes and foods in the collection. */
  readonly subtitle: string;
  readonly kcalLabel: string;
  readonly icon: CollectionIconName;
  readonly toneClass: string;
  readonly item: FoodItem;
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
 * The sheet owns no data: everything is passed on to the page via `selected`, `customFoodCreated`
 * and `scanRequested`.
 */
@Component({
  selector: 'app-food-add-sheet',
  imports: [FoodPicker, TranslatePipe, UiChip, UiEmptyState, UiIcon, UiSegmentedControl, UiSheet],
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

  readonly closed = output<void>();
  /** A finished food, ready for the log (from the picker or from a whole collection). */
  readonly selected = output<FoodItem>();
  readonly customFoodCreated = output<FoodItem>();
  /** A logged custom food's kcal/macros were edited – the page saves the custom food itself. */
  readonly customFoodEdited = output<FoodItem>();
  readonly scanRequested = output<void>();

  private readonly collections = inject(CollectionsService);
  private readonly foodLog = inject(FoodLogService);
  private readonly t = injectTranslate();
  private readonly keyboardOpen = inject(KeyboardService).isOpen;

  protected readonly mealOptions = MEALS;
  protected readonly tabOptions = computed<readonly SegmentOption<AddSheetTab>[]>(() =>
    TAB_LABEL_KEYS.map(({ value, labelKey }) => ({ value, label: this.t(labelKey) })),
  );
  protected readonly emptyMessageKey = COLLECTIONS_EMPTY_MESSAGE_KEY;

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
  /** The user's own food the edited entry was logged from; `null` for system foods. */
  protected readonly editBaseItem = computed<FoodItem | null>(() => {
    const entry = this.editEntry();
    if (!entry?.isCustom) {
      return null;
    }
    return this.foodLog.customFoods().find((food) => food.id === entry.id) ?? null;
  });
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
    this.collections
      .collections()
      .map((collection) => this.toRow(collection))
      .filter((row): row is CollectionRowView => row !== null),
  );

  protected onTabChange(tab: AddSheetTab | null): void {
    this.tab.set(tab ?? DEFAULT_TAB);
  }

  protected onPicked(selection: FoodPickerSelection): void {
    this.selected.emit(selection.item);
  }

  protected onCollectionPicked(row: CollectionRowView): void {
    this.selected.emit(row.item);
  }

  private mealLabel(): string {
    const id = this.meal();
    const meal = MEALS.find((candidate) => candidate.id === id);
    return meal ? this.t(meal.labelKey) : '';
  }

  /** The design's `colsFull`: only collections with content are shown, and they're logged as one combined food. */
  private toRow(collection: FoodCollection): CollectionRowView | null {
    const totals = this.collections.collectionTotals(collection);
    if (totals.count === 0) {
      return null;
    }
    const titles = [
      ...collection.recipeIds
        .map((id) => this.collections.recipeById(id)?.title)
        .filter((title): title is string => title !== undefined),
      ...collection.items.map((item) => item.name),
    ];
    const quantity = this.t(
      totals.count === 1 ? 'food.addSheet.itemCountOne' : 'food.addSheet.itemCountMany',
      { count: totals.count },
    );
    return {
      id: collection.id,
      name: collection.name,
      subtitle: titles.join(', '),
      kcalLabel: `${totals.kcal} ${this.t('common.unit.kcal')}`,
      icon: collection.icon,
      toneClass: `food-add-sheet__icon--${MEAL_TONES[collection.meal]}`,
      item: {
        id: collection.id,
        name: collection.name,
        quantity,
        kcal: totals.kcal,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
      },
    };
  }
}
