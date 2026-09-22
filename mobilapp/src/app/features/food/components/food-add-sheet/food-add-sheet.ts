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
import { CollectionIconName } from '../../../../core/constants/collection-icons';
import { MEALS, MEAL_TONES } from '../../../../core/constants/meals';
import { FoodCollection, FoodItem, LoggedFood } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { CollectionsService } from '../../../../core/services/collections';
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

/** Designets `addTab`: varerne fra søgningen eller brugerens samlinger. */
export type AddSheetTab = 'varer' | 'samlinger';

const DEFAULT_TAB: AddSheetTab = 'varer';
/** Vælgerens trin, indtil den er rejst (den starter altid i søgningen). */
const DEFAULT_PICKER_STEP: FoodPickerStep = 'search';

const TAB_OPTIONS: readonly SegmentOption<AddSheetTab>[] = [
  { value: 'varer', label: 'Varer' },
  { value: 'samlinger', label: 'Samlinger' },
];

/** Designets `addSheetVerb` / `addSheetWhat`. */
const TITLE = {
  add: 'Tilføj',
  edit: 'Rediger',
  editWhat: 'vare',
} as const;

const CTA_VERB = { add: 'Tilføj', edit: 'Gem' } as const satisfies Record<
  'add' | 'edit',
  FoodPickerCtaVerb
>;

const COLLECTIONS_EMPTY_MESSAGE =
  'Du har ingen samlinger med varer endnu. Byg en under Samling, så kan du logge den her med ét tryk.';

/** Én samling i "Samlinger"-fanen – hele samlingen logges som én vare. */
interface CollectionRowView {
  readonly id: string;
  readonly name: string;
  /** Designets `ac.sub`: navnene på retterne og varerne i samlingen. */
  readonly subtitle: string;
  readonly kcalLabel: string;
  readonly icon: CollectionIconName;
  readonly toneClass: string;
  readonly item: FoodItem;
}

/**
 * "Tilføj mad"-arket (designets `addOpen`): måltids-chips, fanerne Varer/Samlinger og
 * enten `app-food-picker` eller listen over samlinger.
 *
 * Fanerne hører kun til søgetrinnet, mens måltids-chipsene også bliver stående på
 * portionstrinnet. Begge dele skjules i "Ny egen vare" og når en allerede logget vare
 * redigeres – så er måltidet givet, og arket hedder "Rediger vare".
 *
 * Indholdet ligger bag `@if (open())`, så vælgeren starter forfra, hver gang arket åbnes.
 * Arket ejer ingen data: alt går videre til siden via `selected`, `customFoodCreated` og
 * `scanRequested`.
 */
@Component({
  selector: 'app-food-add-sheet',
  imports: [FoodPicker, UiChip, UiEmptyState, UiIcon, UiSegmentedControl, UiSheet],
  templateUrl: './food-add-sheet.html',
  styleUrl: './food-add-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'food-add-sheet' },
})
export class FoodAddSheet {
  readonly open = input.required<boolean>();
  /** Måltidet varen logges under. Arket ændrer den selv, når brugeren vælger en chip. */
  readonly meal = model.required<MealId>();
  /** Sat, når en allerede logget vare redigeres: vælgeren åbner direkte på portionstrinnet. */
  readonly editEntry = input<LoggedFood | null>(null);
  /** Vælgerens starttrin – scanneren kan sende brugeren direkte til "Ny egen vare". */
  readonly startStep = input<FoodPickerStartStep>('search');

  readonly closed = output<void>();
  /** En færdig vare, klar til loggen (fra vælgeren eller fra en hel samling). */
  readonly selected = output<FoodItem>();
  readonly customFoodCreated = output<FoodItem>();
  readonly scanRequested = output<void>();

  private readonly collections = inject(CollectionsService);

  protected readonly mealOptions = MEALS;
  protected readonly tabOptions = TAB_OPTIONS;
  protected readonly emptyMessage = COLLECTIONS_EMPTY_MESSAGE;

  /** Hver åbning (og lukning) starter forfra på Varer-fanen. */
  protected readonly tab = linkedSignal<boolean, AddSheetTab>({
    source: this.open,
    computation: () => DEFAULT_TAB,
  });
  /** Vælgeren ejer sit eget trin og oplyser det i `currentStep`; arket spejler det ikke. */
  private readonly picker = viewChild(FoodPicker);
  protected readonly pickerStep = computed<FoodPickerStep>(
    () => this.picker()?.currentStep() ?? DEFAULT_PICKER_STEP,
  );

  protected readonly isEditing = computed(() => this.editEntry() !== null);
  protected readonly title = computed(() => (this.isEditing() ? TITLE.edit : TITLE.add));
  protected readonly titleAccent = computed(() =>
    this.isEditing() ? TITLE.editWhat : this.mealLabel().toLowerCase(),
  );
  protected readonly ctaVerb = computed<FoodPickerCtaVerb>(() =>
    this.isEditing() ? CTA_VERB.edit : CTA_VERB.add,
  );
  protected readonly saveAndLogLabel = computed(
    () => `Gem og log under ${this.mealLabel().toLowerCase()}`,
  );

  /**
   * Designets `showMealPicks`: chipsene bliver stående på portionstrinnet, så måltidet kan
   * skiftes, lige inden varen logges. De forsvinder kun i "Ny egen vare" og under redigering.
   */
  protected readonly showMealPicks = computed(
    () => !this.isEditing() && this.pickerStep() !== 'new-food',
  );
  /** Designets `addTabsVisible`: fanerne hører kun til søgetrinnet. */
  protected readonly showTabs = computed(() => !this.isEditing() && this.pickerStep() === 'search');
  /** Redigering går altid gennem vælgeren, uanset hvilken fane der sidst var valgt. */
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
    return MEALS.find((meal) => meal.id === id)?.label ?? '';
  }

  /** Designets `colsFull`: kun samlinger med indhold vises, og de logges som én samlet vare. */
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
    const quantity = `${totals.count} ${totals.count === 1 ? 'vare' : 'varer'}`;
    return {
      id: collection.id,
      name: collection.name,
      subtitle: titles.join(', '),
      kcalLabel: `${totals.kcal} kcal`,
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
