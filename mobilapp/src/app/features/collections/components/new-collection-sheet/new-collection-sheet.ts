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
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  COLLECTION_ICON_LABELS,
  COLLECTION_ICON_NAMES,
  COLLECTION_ICON_PREVIEW_COUNT,
  CollectionIconName,
} from '../../../../core/constants/collection-icons';
import { FoodItem, NewCollectionInput } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { FoodLogService } from '../../../../core/services/food-log';
import { IdService } from '../../../../core/services/id';
import { BarcodeScanner } from '../../../../shared/components/barcode-scanner/barcode-scanner';
import {
  FoodPicker,
  FoodPickerSelection,
  FoodPickerStartStep,
} from '../../../../shared/components/food-picker/food-picker';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
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
/** Vare-vælgerens primærknap, når varen lander i en samling frem for i dagens log. */
const SAVE_AND_ADD_LABEL = 'Gem og føj til samlingen';
/** Ikongitteret har seks kolonner, så op/ned springer en hel række. */
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
 * Arket "Ny samling": navn, måltid, ikon og en kladde af varer.
 *
 * Arket ejer kladden, men skriver ikke selv i `CollectionsService` – det udsender `created`
 * med en `NewCollectionInput`, så siden kan oprette samlingen og vælge det rigtige filter
 * bagefter (designets `createCol`, der også sætter `colId`).
 *
 * "Søg vare" åbner `app-food-picker` i et ark oven på dette (`sheet-high`), og "Scan" åbner
 * `app-barcode-scanner`. Begge veje ender samme sted: varen lægges i kladden. Egne varer
 * gemmes samtidig under "Mine varer" via `FoodLogService`, så de kan søges frem igen.
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
  /** Måltidet, arket åbner med – det valgte filter på samlingsskærmen. */
  readonly defaultMeal = input<MealId>(DEFAULT_MEAL);

  readonly closed = output<void>();
  readonly created = output<NewCollectionInput>();

  private readonly ids = inject(IdService);
  private readonly foodLog = inject(FoodLogService);

  protected readonly form = new FormGroup<NewCollectionForm>({
    name: new FormControl('', { nonNullable: true }),
  });
  private readonly name = toSignal(
    this.form.controls.name.valueChanges.pipe(map((value) => value.trim())),
    { initialValue: '' },
  );
  protected readonly canCreate = computed(() => this.name() !== '');

  protected readonly meal = signal<MealId>(DEFAULT_MEAL);
  protected readonly icon = signal<CollectionIconName>(DEFAULT_ICON);
  protected readonly draft = signal<readonly FoodItem[]>([]);

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
  /** Indeks for det valgte ikon i det gitter, der faktisk vises – −1 når det er foldet væk. */
  private readonly selectedIconIndex = computed(() => this.icons().indexOf(this.icon()));

  constructor() {
    // Hver gang arket åbnes, starter det forfra (designets `openNewCol`).
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
   * Kun det valgte ikon er i tab-rækkefølgen. Er det valgte foldet væk ("Vis færre"),
   * overtager det første synlige, så gitteret aldrig falder helt ud af tab-rækkefølgen.
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

  /** Scanneren lægger sig øverst; vare-vælgeren lukkes, så der kun er én vej tilbage. */
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

  /** Egne varer gemmes under "Mine varer"; kladden får dem først, når de også vælges. */
  protected onCustomFoodCreated(item: FoodItem): void {
    this.foodLog.addCustomFood(item);
  }

  protected onScanned(item: FoodItem): void {
    this.putInDraft(item);
  }

  protected onScannerCustomSaved(item: FoodItem): void {
    this.foodLog.addCustomFood(item);
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

  protected create(): void {
    const name = this.name();
    if (name === '') {
      return;
    }
    this.created.emit({ name, icon: this.icon(), meal: this.meal(), items: this.draft() });
  }

  /** Tilføjer varen eller erstatter den, der redigeres. Kladdens varer får eget id. */
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
    this.draft.update((items) => [...items, { ...item, id: this.ids.next(DRAFT_ID_PREFIX) }]);
  }

  private reset(): void {
    this.form.reset({ name: '' });
    this.meal.set(this.defaultMeal());
    this.icon.set(DEFAULT_ICON);
    this.draft.set([]);
    this.showAllIcons.set(false);
    this.pickerOpen.set(false);
    this.scannerOpen.set(false);
    this.editIndex.set(null);
  }
}
