import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { newId } from '../../../../core/utils/id';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  COLLECTION_ICON_LABELS,
  COLLECTION_ICON_NAMES,
  COLLECTION_ICON_PREVIEW_COUNT,
  CollectionIconName,
} from '../../../../core/constants/collection-icons';
import { FoodCollection, FoodItem, NewCollectionInput } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { CollectionsService } from '../../../../core/services/collections';
import { DuplicateCustomFoodNameError, FoodLogService } from '../../../../core/services/food-log';
import { BarcodeScanner } from '../../../../shared/components/barcode-scanner/barcode-scanner';
import {
  FoodPicker,
  FoodPickerSelection,
  FoodPickerStartStep,
} from '../../../../shared/components/food-picker/food-picker';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';
import { MealPicker } from '../meal-picker/meal-picker';

const DEFAULT_ICON: CollectionIconName = 'star';
const DEFAULT_MEAL: MealId = 'morgen';
const DRAFT_ID_PREFIX = 'item';
const HIDDEN_ICON_COUNT = COLLECTION_ICON_NAMES.length - COLLECTION_ICON_PREVIEW_COUNT;
const MORE_ICONS_LABEL = {
  collapsed: `Vis flere (${HIDDEN_ICON_COUNT})`,
  expanded: 'Vis færre',
} as const;
const DUPLICATE_NAME_MESSAGE = 'Du har allerede en samling med det navn.';
/** A new custom food clashed with an existing one's name – it's still put in the draft. */
const DUPLICATE_CUSTOM_FOOD_MESSAGE = (name: string): string =>
  `Du har allerede en egen vare med navnet "${name}", så den blev ikke gemt igen under Mine varer.`;
/** Heading and primary button – "Ny samling" when creating, "Rediger samling" when editing. */
const SHEET_TEXT = {
  create: { title: 'Ny', submit: 'Opret samling' },
  edit: { title: 'Rediger', submit: 'Gem ændringer' },
} as const;
/** The food picker's primary button when the food lands in a collection instead of today's log. */
const SAVE_AND_ADD_LABEL = 'Gem og føj til samlingen';
/** The icon grid has six columns, so up/down jumps a whole row. */
const ICON_KEY_DELTAS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -6,
  ArrowDown: 6,
};

interface NewCollectionForm {
  name: FormControl<string>;
}

/**
 * The "New collection" sheet: name, meal, icon and a draft of foods. Given a `collection`, the
 * same sheet edits it instead ("Rediger samling"): it opens prefilled and emits `updated`.
 *
 * The sheet owns the draft but doesn't write to `CollectionsService` itself – it emits `created`
 * (or `updated`) with a `NewCollectionInput`, so the page can save the collection and select the
 * right filter afterwards (the design's `createCol`, which also sets `colId`). It only reads the
 * service to block a name another collection already has.
 *
 * "Search food" opens `app-food-picker` in a sheet on top of this one (`sheet-high`), and "Scan"
 * opens `app-barcode-scanner`. Both paths end up the same place: the food is put in the draft.
 * Custom foods are simultaneously saved under "My foods" via `FoodLogService`, so they can be
 * searched for again.
 */
@Component({
  selector: 'app-new-collection-sheet',
  imports: [
    BarcodeScanner,
    FoodPicker,
    MealPicker,
    ReactiveFormsModule,
    UiButton,
    UiEmptyState,
    UiFormError,
    UiIcon,
    UiSheet,
    UiTextInput,
  ],
  templateUrl: './new-collection-sheet.html',
  styleUrl: './new-collection-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'new-collection-sheet' },
})
export class NewCollectionSheet {
  readonly open = input.required<boolean>();
  /** The meal the sheet opens with – the selected filter on the collections screen. */
  readonly defaultMeal = input<MealId>(DEFAULT_MEAL);
  /** The user collection to edit. `null` (the default) creates a new one. */
  readonly collection = input<FoodCollection | null>(null);

  readonly closed = output<void>();
  readonly created = output<NewCollectionInput>();
  readonly updated = output<NewCollectionInput>();
  private readonly foodLog = inject(FoodLogService);
  private readonly collections = inject(CollectionsService);

  protected readonly form = new FormGroup<NewCollectionForm>({
    name: new FormControl('', { nonNullable: true }),
  });
  private readonly name = toSignal(
    this.form.controls.name.valueChanges.pipe(map((value) => value.trim())),
    { initialValue: '' },
  );
  /** Another collection has the name (trimmed, case-insensitive) – the one being edited excepted. */
  protected readonly nameTaken = computed(() => {
    const name = this.name();
    return name !== '' && this.collections.isNameTaken(name, this.collection()?.id);
  });
  protected readonly nameError = computed(() => (this.nameTaken() ? DUPLICATE_NAME_MESSAGE : null));
  protected readonly canSave = computed(() => this.name() !== '' && !this.nameTaken());
  protected readonly text = computed(() =>
    this.collection() ? SHEET_TEXT.edit : SHEET_TEXT.create,
  );

  protected readonly meal = signal<MealId>(DEFAULT_MEAL);
  protected readonly icon = signal<CollectionIconName>(DEFAULT_ICON);
  protected readonly draft = signal<readonly FoodItem[]>([]);
  /** Feedback when a custom food couldn't be saved under "My foods"; cleared on reset. */
  protected readonly customFoodError = signal<string | null>(null);

  private readonly showAllIcons = signal(false);
  protected readonly icons = computed<readonly CollectionIconName[]>(() =>
    this.showAllIcons()
      ? COLLECTION_ICON_NAMES
      : COLLECTION_ICON_NAMES.slice(0, COLLECTION_ICON_PREVIEW_COUNT),
  );
  protected readonly moreIconsLabel = computed(() =>
    this.showAllIcons() ? MORE_ICONS_LABEL.expanded : MORE_ICONS_LABEL.collapsed,
  );

  protected readonly pickerOpen = signal(false);
  protected readonly pickerStartStep = signal<FoodPickerStartStep>('search');
  protected readonly scannerOpen = signal(false);
  private readonly editIndex = signal<number | null>(null);
  protected readonly editItem = computed<FoodItem | null>(() => {
    const index = this.editIndex();
    return index === null ? null : (this.draft()[index] ?? null);
  });
  protected readonly saveAndAddLabel = SAVE_AND_ADD_LABEL;

  private readonly iconOptions = viewChildren<ElementRef<HTMLButtonElement>>('iconOption');
  /** Index of the selected icon in the grid actually shown – −1 when it's folded away. */
  private readonly selectedIconIndex = computed(() => this.icons().indexOf(this.icon()));

  constructor() {
    // Every time the sheet opens, it starts over (the design's `openNewCol`) – or from the
    // collection being edited.
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected selectIcon(icon: CollectionIconName): void {
    this.icon.set(icon);
  }

  protected iconLabel(icon: CollectionIconName): string {
    return COLLECTION_ICON_LABELS[icon];
  }

  /**
   * Only the selected icon is in the tab order. If the selected one is folded away ("Show fewer"),
   * the first visible one takes over, so the grid never falls completely out of the tab order.
   */
  protected iconTabIndexFor(index: number): number {
    const selected = this.selectedIconIndex();
    return (selected < 0 ? index === 0 : index === selected) ? 0 : -1;
  }

  protected onIconKeydown(event: KeyboardEvent): void {
    const delta = ICON_KEY_DELTAS[event.key];
    const icons = this.icons();
    if (delta === undefined || icons.length === 0) {
      return;
    }
    event.preventDefault();
    const current = this.selectedIconIndex();
    const next = current < 0 ? 0 : (current + delta + icons.length) % icons.length;
    const icon = icons[next];
    if (icon === undefined) {
      return;
    }
    this.icon.set(icon);
    this.iconOptions()[next]?.nativeElement.focus();
  }

  protected toggleIcons(): void {
    this.showAllIcons.update((shown) => !shown);
  }

  protected removeAt(index: number): void {
    this.draft.update((items) => items.filter((_, position) => position !== index));
  }

  protected editAt(index: number): void {
    this.editIndex.set(index);
    this.pickerStartStep.set('search');
    this.pickerOpen.set(true);
  }

  protected openSearch(): void {
    this.editIndex.set(null);
    this.pickerStartStep.set('search');
    this.pickerOpen.set(true);
  }

  protected openScanner(): void {
    this.scannerOpen.set(true);
  }

  /** The scanner sits on top; the food picker closes, so there's only one way back. */
  protected openScannerFromPicker(): void {
    this.pickerOpen.set(false);
    this.scannerOpen.set(true);
  }

  protected closePicker(): void {
    this.pickerOpen.set(false);
    this.editIndex.set(null);
  }

  protected onPicked(selection: FoodPickerSelection): void {
    this.putInDraft(selection.item);
    this.closePicker();
  }

  /** Custom foods are saved under "My foods"; the draft only gets them once they're also selected. */
  protected onCustomFoodCreated(item: FoodItem): void {
    this.saveCustomFood(item);
  }

  protected onScanned(item: FoodItem): void {
    this.putInDraft(item);
  }

  protected onScannerCustomSaved(item: FoodItem): void {
    this.saveCustomFood(item);
    this.putInDraft(item);
  }

  protected onManualRequested(): void {
    this.editIndex.set(null);
    this.pickerStartStep.set('search');
    this.pickerOpen.set(true);
  }

  protected onNoBarcodeRequested(): void {
    this.editIndex.set(null);
    this.pickerStartStep.set('new-food');
    this.pickerOpen.set(true);
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }
    const input: NewCollectionInput = {
      name: this.name(),
      icon: this.icon(),
      meal: this.meal(),
      items: this.draft(),
    };
    if (this.collection()) {
      this.updated.emit(input);
    } else {
      this.created.emit(input);
    }
  }

  /**
   * Saves under "My foods" with the item's own id. A taken name (the scanner's form doesn't
   * check it) shows a message instead of failing; the draft is unaffected either way.
   */
  private saveCustomFood(item: FoodItem): void {
    this.customFoodError.set(null);
    try {
      this.foodLog.addCustomFood(item, item.id);
    } catch (error) {
      if (!(error instanceof DuplicateCustomFoodNameError)) {
        throw error;
      }
      this.customFoodError.set(DUPLICATE_CUSTOM_FOOD_MESSAGE(item.name));
    }
  }

  /** Adds the food or replaces the one being edited. Draft foods get their own id. */
  private putInDraft(item: FoodItem): void {
    const index = this.editIndex();
    if (index !== null) {
      this.draft.update((items) =>
        items.map((current, position) =>
          position === index ? { ...item, id: current.id } : current,
        ),
      );
      this.editIndex.set(null);
      return;
    }
    this.draft.update((items) => [...items, { ...item, id: newId(DRAFT_ID_PREFIX) }]);
  }

  private reset(): void {
    const collection = this.collection();
    const icon = collection?.icon ?? DEFAULT_ICON;
    this.form.reset({ name: collection?.name ?? '' });
    this.meal.set(collection?.meal ?? this.defaultMeal());
    this.icon.set(icon);
    this.draft.set(collection?.items ?? []);
    this.customFoodError.set(null);
    // An edited collection's icon may sit among the folded-away ones – show them all then.
    this.showAllIcons.set(COLLECTION_ICON_NAMES.indexOf(icon) >= COLLECTION_ICON_PREVIEW_COUNT);
    this.pickerOpen.set(false);
    this.scannerOpen.set(false);
    this.editIndex.set(null);
  }
}
