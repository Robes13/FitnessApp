import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QUERY_PARAM } from '../../../../core/constants/app-route';
import { MEAL_IDS } from '../../../../core/constants/meals';
import { FoodItem, LoggedFood } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { FoodLogService } from '../../../../core/services/food-log';
import { BarcodeScanner } from '../../../../shared/components/barcode-scanner/barcode-scanner';
import { FoodPickerStartStep } from '../../../../shared/components/food-picker/food-picker';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiProgressBar } from '../../../../shared/components/ui-progress-bar/ui-progress-bar';
import { UiProgressRing } from '../../../../shared/components/ui-progress-ring/ui-progress-ring';
import { FoodAddSheet } from '../../components/food-add-sheet/food-add-sheet';
import { FoodMealGroup } from '../../components/food-meal-group/food-meal-group';
import { DEFAULT_MEAL, FoodViewService } from '../../services/food-view';

/**
 * Query-parameteren, Hjem åbner arket med. Angulars compiler kræver en literal i
 * `input(…, { alias })` og kan ikke slå en konstant op, så navnet står også skrevet ud dér.
 * Typeannotationen her fejler i build, hvis `QUERY_PARAM.ADD_MEAL` ændres, så de to
 * steder ikke kan komme fra hinanden.
 */
const ADD_MEAL_PARAM: 'tilfoej' = QUERY_PARAM.ADD_MEAL;

/**
 * Designets kaloriering: 84 px boks, streg 8,4 px (designets 10 enheder i en
 * 100-enheders viewBox skaleret ned til 84 px).
 */
const KCAL_RING_DIAMETER = 84;
const KCAL_RING_STROKE_WIDTH = 8.4;

/**
 * Mad-skærmen: dagens kalorier og makroer, de fire måltidsgrupper og vejene ind i loggen –
 * "Tilføj mad"-arket og stregkodescanneren.
 *
 * Siden ejer kun UI-tilstanden omkring arket (åbent, valgt måltid, vare under redigering).
 * Alle tal kommer fra `FoodViewService`, og loggen ændres udelukkende gennem `FoodLogService`.
 *
 * `/mad?tilfoej=<måltid>` (fra Hjem) åbner arket på det måltid. Parameteren bindes som input
 * (`withComponentInputBinding()`) og fjernes fra URL'en igen, så en genindlæsning eller et
 * tilbage-tryk ikke åbner arket på ny.
 */
@Component({
  selector: 'app-food-page',
  imports: [
    BarcodeScanner,
    FoodAddSheet,
    FoodMealGroup,
    UiButton,
    UiIcon,
    UiIconButton,
    UiProgressBar,
    UiProgressRing,
  ],
  templateUrl: './food-page.html',
  styleUrl: './food-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'food-page' },
})
export class FoodPage {
  /** `?tilfoej=<måltid>` – ukendte værdier ignoreres. Aliaset er `ADD_MEAL_PARAM`. */
  readonly addMealParam = input<string | undefined>(undefined, { alias: 'tilfoej' });

  protected readonly view = inject(FoodViewService);
  private readonly foodLog = inject(FoodLogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly ringDiameter = KCAL_RING_DIAMETER;
  protected readonly ringStrokeWidth = KCAL_RING_STROKE_WIDTH;

  protected readonly addOpen = signal(false);
  protected readonly addMeal = signal<MealId>(DEFAULT_MEAL);
  protected readonly editEntry = signal<LoggedFood | null>(null);
  protected readonly pickerStartStep = signal<FoodPickerStartStep>('search');
  protected readonly scannerOpen = signal(false);

  /** Måltidet, scanneren gemmer under – teksten hører til scannerens CTA. */
  protected readonly scannerMealLabel = computed(() => this.view.mealLabel(this.addMeal()));

  constructor() {
    effect(() => {
      const meal = MEAL_IDS.find((id) => id === this.addMealParam());
      if (!meal) {
        return;
      }
      untracked(() => this.startAdd(meal, 'search'));
      // Fjern kun vores egen parameter, så et genbesøg (eller tilbage) ikke åbner arket igen.
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { [ADD_MEAL_PARAM]: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  // --- Arket ---------------------------------------------------------------------------------

  /** "Tilføj mad" – beholder det måltid, arket sidst stod på (designets `openAdd`). */
  protected openAdd(): void {
    this.startAdd(this.addMeal(), 'search');
  }

  /** "+ Tilføj til <måltid>" i en måltidsgruppe. */
  protected openAddFor(meal: MealId): void {
    this.startAdd(meal, 'search');
  }

  protected openEdit(entry: LoggedFood): void {
    this.editEntry.set(entry);
    this.addMeal.set(entry.meal);
    this.pickerStartStep.set('search');
    this.addOpen.set(true);
  }

  protected closeAdd(): void {
    this.addOpen.set(false);
    this.editEntry.set(null);
  }

  protected removeEntry(entry: LoggedFood): void {
    this.foodLog.remove(entry.logId);
  }

  /** Én færdig vare fra arket: opdatér den redigerede post, ellers læg den i loggen. */
  protected onSelected(item: FoodItem): void {
    const editing = this.editEntry();
    if (editing) {
      this.foodLog.update(editing.logId, { ...item });
    } else {
      this.foodLog.add(item, this.addMeal());
    }
    this.closeAdd();
  }

  protected onCustomFoodCreated(item: FoodItem): void {
    this.foodLog.addCustomFood(toCustomFoodInput(item));
  }

  // --- Scanneren -----------------------------------------------------------------------------

  /**
   * Scanneren lægger sig oven på arket uden at lukke det, så et tryk på ✕ i scanneren
   * fører tilbage til arket – som i designet, hvor `openScan` ikke rører `addOpen`.
   */
  protected openScanner(): void {
    this.scannerOpen.set(true);
  }

  protected onScanFound(item: FoodItem): void {
    this.foodLog.add(item, this.addMeal());
    this.closeAdd();
  }

  /** "Ukendt vare" gemt: den bliver en egen vare og lægges samtidig i loggen. */
  protected onScanCustomSaved(item: FoodItem): void {
    this.foodLog.add(this.foodLog.addCustomFood(toCustomFoodInput(item)), this.addMeal());
    this.closeAdd();
  }

  protected onScanManual(): void {
    this.startAdd(this.addMeal(), 'search');
  }

  protected onScanNoBarcode(): void {
    this.startAdd(this.addMeal(), 'new-food');
  }

  protected onScannerClosed(): void {
    this.scannerOpen.set(false);
  }

  private startAdd(meal: MealId, step: FoodPickerStartStep): void {
    this.editEntry.set(null);
    this.addMeal.set(meal);
    this.pickerStartStep.set(step);
    this.addOpen.set(true);
  }
}

/** `FoodLogService.addCustomFood` sætter selv id og `isCustom`. */
function toCustomFoodInput(item: FoodItem): Omit<FoodItem, 'id' | 'isCustom'> {
  return {
    name: item.name,
    quantity: item.quantity,
    kcal: item.kcal,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    brand: item.brand,
  };
}
