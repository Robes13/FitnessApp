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
 * The query parameter Home opens the sheet with. Angular's compiler requires a literal in
 * `input(…, { alias })` and can't look up a constant, so the name is also spelled out there.
 * The type annotation here fails the build if `QUERY_PARAM.ADD_MEAL` changes, so the two
 * places can't drift apart.
 */
const ADD_MEAL_PARAM: 'tilfoej' = QUERY_PARAM.ADD_MEAL;

/**
 * The design's calorie ring: 84px box, 8.4px stroke (the design's 10 units in a
 * 100-unit viewBox scaled down to 84px).
 */
const KCAL_RING_DIAMETER = 84;
const KCAL_RING_STROKE_WIDTH = 8.4;

/**
 * The Mad screen: today's calories and macros, the four meal groups and the ways into the log –
 * the "Add food" sheet and the barcode scanner.
 *
 * The page only owns the UI state around the sheet (open, selected meal, food being edited).
 * All numbers come from `FoodViewService`, and the log is only ever changed through `FoodLogService`.
 *
 * `/mad?tilfoej=<meal>` (from Home) opens the sheet on that meal. The parameter is bound as input
 * (`withComponentInputBinding()`) and removed from the URL again, so a reload or a back press
 * doesn't reopen the sheet.
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
  /** `?tilfoej=<meal>` – unknown values are ignored. The alias is `ADD_MEAL_PARAM`. */
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

  /** The meal the scanner saves under – the text belongs to the scanner's CTA. */
  protected readonly scannerMealLabel = computed(() => this.view.mealLabel(this.addMeal()));

  constructor() {
    effect(() => {
      const meal = MEAL_IDS.find((id) => id === this.addMealParam());
      if (!meal) {
        return;
      }
      untracked(() => this.startAdd(meal, 'search'));
      // Only remove our own parameter, so a revisit (or back) doesn't reopen the sheet.
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { [ADD_MEAL_PARAM]: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  // --- The sheet -------------------------------------------------------------------------------

  /** "Add food" – keeps the meal the sheet was last on (the design's `openAdd`). */
  protected openAdd(): void {
    this.startAdd(this.addMeal(), 'search');
  }

  /** "+ Add to <meal>" in a meal group. */
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

  /** A finished food from the sheet: update the edited entry, otherwise add it to the log. */
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

  // --- The scanner -----------------------------------------------------------------------------

  /**
   * The scanner sits on top of the sheet without closing it, so tapping ✕ in the scanner
   * leads back to the sheet – as in the design, where `openScan` doesn't touch `addOpen`.
   */
  protected openScanner(): void {
    this.scannerOpen.set(true);
  }

  protected onScanFound(item: FoodItem): void {
    this.foodLog.add(item, this.addMeal());
    this.closeAdd();
  }

  /** "Unknown food" saved: it becomes a custom food and is added to the log at the same time. */
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

/** `FoodLogService.addCustomFood` sets `id` and `isCustom` itself. */
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
