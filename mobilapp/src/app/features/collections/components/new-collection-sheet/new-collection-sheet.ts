import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize, map } from 'rxjs';
import {
  COLLECTION_MAX_ITEMS,
  COLLECTION_NAME_MAX_LENGTH,
} from '../../../../core/constants/collections';
import {
  CollectionItem,
  FoodCollection,
  FoodItem,
  NewCollectionInput,
} from '../../../../core/models/food';
import { CollectionsService } from '../../../../core/services/collections/collections';
import {
  CUSTOM_FOOD_ID_PREFIX,
  DuplicateCustomFoodNameError,
  FoodLogService,
} from '../../../../core/services/food-log/food-log';
import { injectTranslate } from '../../../../core/services/language/translate';
import { toApiError } from '../../../../core/utils/api';
import { formatGrams, formatInteger } from '../../../../core/utils/date-format';
import { formatQuantity } from '../../../../core/utils/quantity';
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

const DUPLICATE_NAME_MESSAGE_KEY = 'collections.newCollectionSheet.duplicateName';
/** A new custom food clashed with an existing one's name – it's still put in the draft. Param `foodName`. */
const DUPLICATE_CUSTOM_FOOD_MESSAGE_KEY = 'collections.newCollectionSheet.duplicateCustomFood';
const REMOVE_ITEM_LABEL_KEY = 'collections.newCollectionSheet.removeItem';
/** Heading and primary button – "Ny samling" when creating, "Rediger samling" when editing. */
const SHEET_TEXT_KEY = {
  create: {
    title: 'collections.newCollectionSheet.titleNew',
    submit: 'collections.newCollectionSheet.submitCreate',
  },
  edit: {
    title: 'collections.newCollectionSheet.titleEdit',
    submit: 'collections.newCollectionSheet.submitEdit',
  },
} as const;
/** The food picker's primary button when the food lands in a collection instead of today's log. */
const SAVE_AND_ADD_LABEL_KEY = 'collections.newCollectionSheet.saveAndAdd';
/** Its "Gem uden at logge": a collection logs nothing, the food is only saved under "Mine varer". */
const SAVE_ONLY_LABEL_KEY = 'collections.newCollectionSheet.saveOnly';
/** The food picker's sheet – "Tilføj til samling", or "Rediger vare" while an item is edited. */
const PICKER_TEXT_KEY = {
  add: {
    title: 'collections.newCollectionSheet.pickerTitle',
    accent: 'collections.newCollectionSheet.pickerTitleAccent',
  },
  edit: {
    title: 'collections.newCollectionSheet.pickerTitleEdit',
    accent: 'collections.newCollectionSheet.pickerTitleEditAccent',
  },
} as const;

interface NewCollectionForm {
  name: FormControl<string>;
}

/**
 * The "New collection" sheet: a name and a draft of 1–50 foods. Given a `collection`, the same
 * sheet edits it instead ("Rediger samling"): it opens prefilled and emits `updated`.
 *
 * The sheet owns the draft but doesn't write to `CollectionsService` itself – it emits `created`
 * (or `updated`) with a `NewCollectionInput`, and the page saves it (`busy`, `error`). It only
 * reads the service to block a name another collection already has.
 *
 * "Search food" opens `app-food-picker` in a sheet on top of this one (`sheet-high`), and "Scan"
 * opens `app-barcode-scanner`. Both paths end up the same place: the food is put in the draft
 * under its own id (catalogue id, `off-…` or `food-…`), which `ensureFood` resolves on save.
 * Custom foods are simultaneously saved under "My foods" via `FoodLogService`, so they can be
 * searched for again.
 */
@Component({
  selector: 'app-new-collection-sheet',
  imports: [
    BarcodeScanner,
    FoodPicker,
    ReactiveFormsModule,
    TranslatePipe,
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
  /** The user collection to edit. `null` (the default) creates a new one. */
  readonly collection = input<FoodCollection | null>(null);
  /** The page is saving – the button shows a spinner and ignores taps. */
  readonly busy = input(false, { transform: booleanAttribute });
  /** Why the last save failed (translated), or `null`. */
  readonly error = input<string | null>(null);

  readonly closed = output<void>();
  readonly created = output<NewCollectionInput>();
  readonly updated = output<NewCollectionInput>();
  private readonly foodLog = inject(FoodLogService);
  private readonly collections = inject(CollectionsService);
  private readonly t = injectTranslate();

  protected readonly nameMaxLength = COLLECTION_NAME_MAX_LENGTH;
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
  protected readonly nameError = computed(() =>
    this.nameTaken() ? this.t(DUPLICATE_NAME_MESSAGE_KEY) : null,
  );
  protected readonly draft = signal<readonly CollectionItem[]>([]);
  /** The API's limit is reached – "Søg vare" and "Scan" are off. */
  protected readonly draftFull = computed(() => this.draft().length >= COLLECTION_MAX_ITEMS);
  /**
   * Spec 4.0/4.1-8a: at least one item; the API holds at most 50. Not while a custom food is
   * still being saved – `ensureFood` would create it a second time (409).
   */
  protected readonly canSave = computed(() => {
    const count = this.draft().length;
    return (
      this.name() !== '' &&
      !this.nameTaken() &&
      !this.savingCustomFood() &&
      count >= 1 &&
      count <= COLLECTION_MAX_ITEMS
    );
  });
  /** Spec 4.0/4.1: the draft's total nutrition (kcal, protein, carbs, fat), recalculated as items change. */
  protected readonly totalsText = computed(() => {
    const totals = this.collections.collectionTotals({ id: '', name: '', items: this.draft() });
    return this.t('collections.view.totals', {
      kcal: formatInteger(totals.kcal),
      protein: formatGrams(totals.protein),
      carbs: formatGrams(totals.carbs),
      fat: formatGrams(totals.fat),
    });
  });
  protected readonly text = computed(() => {
    const keys = this.collection() ? SHEET_TEXT_KEY.edit : SHEET_TEXT_KEY.create;
    return { title: this.t(keys.title), submit: this.t(keys.submit) };
  });

  /** Why a custom food couldn't be saved under "My foods" (key + params); cleared on reset. */
  private readonly customFoodFailure = signal<{
    readonly key: string;
    readonly params?: Readonly<Record<string, string>>;
  } | null>(null);
  /** Feedback when a custom food couldn't be saved under "My foods". */
  protected readonly customFoodError = computed(() => {
    const failure = this.customFoodFailure();
    return failure === null ? null : this.t(failure.key, failure.params);
  });

  protected readonly pickerOpen = signal(false);
  /** A custom food is being saved – the picker blocks a second save meanwhile. */
  protected readonly savingCustomFood = signal(false);
  protected readonly pickerStartStep = signal<FoodPickerStartStep>('search');
  /** The barcode a not-found scan hands the picker's new-food form (3.1-6a); `null` otherwise. */
  protected readonly newFoodBarcode = signal<string | null>(null);
  protected readonly scannerOpen = signal(false);
  private readonly editIndex = signal<number | null>(null);
  protected readonly editItem = computed<CollectionItem | null>(() => {
    const index = this.editIndex();
    return index === null ? null : (this.draft()[index] ?? null);
  });
  protected readonly saveAndAddLabelKey = SAVE_AND_ADD_LABEL_KEY;
  protected readonly saveOnlyLabelKey = SAVE_ONLY_LABEL_KEY;
  protected readonly pickerText = computed(() => {
    const keys = this.editItem() ? PICKER_TEXT_KEY.edit : PICKER_TEXT_KEY.add;
    return { title: this.t(keys.title), accent: this.t(keys.accent) };
  });

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

  protected removeLabel(item: FoodItem): string {
    return this.t(REMOVE_ITEM_LABEL_KEY, { foodName: item.name });
  }

  /** Whole kcal as shown, `'1.600'`. */
  protected kcal(item: FoodItem): string {
    return formatInteger(item.kcal);
  }

  /** `'2 portioner'` – the unit in the active language. */
  protected quantity(item: FoodItem): string {
    return formatQuantity(this.t, item.quantity);
  }

  protected removeAt(index: number): void {
    this.draft.update((items) => items.filter((_, position) => position !== index));
  }

  protected editAt(index: number): void {
    this.editIndex.set(index);
    this.pickerStartStep.set('search');
    this.newFoodBarcode.set(null);
    this.pickerOpen.set(true);
  }

  protected openSearch(): void {
    this.editIndex.set(null);
    this.pickerStartStep.set('search');
    this.newFoodBarcode.set(null);
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
    // "Save and add" only emits `picked`, so a new custom food is saved under "My foods" here.
    if (selection.item.id.startsWith(`${CUSTOM_FOOD_ID_PREFIX}-`)) {
      this.saveCustomFood(selection.item);
    }
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

  protected onManualRequested(): void {
    this.openSearch();
  }

  /** "Opret varen selv" after "not found" carries the barcode, so the next scan finds the food. */
  protected onNoBarcodeRequested(barcode: string | null): void {
    this.editIndex.set(null);
    this.pickerStartStep.set('new-food');
    this.newFoodBarcode.set(barcode);
    this.pickerOpen.set(true);
  }

  protected save(): void {
    if (!this.canSave() || this.busy()) {
      return;
    }
    const input: NewCollectionInput = { name: this.name(), items: this.draft() };
    if (this.collection()) {
      this.updated.emit(input);
    } else {
      this.created.emit(input);
    }
  }

  /**
   * Saves under "My foods" in the API. A failure (e.g. a name taken on another device) shows a
   * message; the draft is unaffected either way. Not cancelled on close, so the save isn't lost.
   */
  private saveCustomFood(item: FoodItem): void {
    this.customFoodFailure.set(null);
    this.savingCustomFood.set(true);
    this.foodLog
      .addCustomFood(item)
      .pipe(finalize(() => this.savingCustomFood.set(false)))
      .subscribe({
        error: (error: unknown) =>
          this.customFoodFailure.set(
            error instanceof DuplicateCustomFoodNameError
              ? { key: DUPLICATE_CUSTOM_FOOD_MESSAGE_KEY, params: { foodName: item.name } }
              : { key: toApiError(error).messageKey },
          ),
      });
  }

  /**
   * Adds the food or replaces the one being edited. An item whose food or amount changed loses
   * its `mealItemId`, so saving the edit deletes the old item and adds the new one.
   */
  private putInDraft(item: FoodItem): void {
    const index = this.editIndex();
    this.editIndex.set(null);
    if (index === null) {
      this.draft.update((items) => [...items, item]);
      return;
    }
    this.draft.update((items) =>
      items.map((current, position) =>
        position !== index || (current.id === item.id && current.quantity === item.quantity)
          ? current
          : { ...item, mealItemId: undefined },
      ),
    );
  }

  private reset(): void {
    const collection = this.collection();
    this.form.reset({ name: collection?.name ?? '' });
    this.draft.set(collection?.items ?? []);
    this.customFoodFailure.set(null);
    this.pickerOpen.set(false);
    this.scannerOpen.set(false);
    this.editIndex.set(null);
  }
}
