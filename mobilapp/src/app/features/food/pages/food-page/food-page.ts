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
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, concatMap, finalize, from, toArray } from 'rxjs';
import { API_ERROR_MESSAGE_KEY } from '../../../../core/constants/api';
import { QUERY_PARAM } from '../../../../core/constants/app-route';
import { MEAL_IDS } from '../../../../core/constants/meals';
import { FoodItem, LoggedFood } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import {
  DuplicateCustomFoodNameError,
  FoodLogService,
} from '../../../../core/services/food-log/food-log';
import { injectTranslate } from '../../../../core/services/language/translate';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { toApiError } from '../../../../core/utils/api';
import { BarcodeScanner } from '../../../../shared/components/barcode-scanner/barcode-scanner';
import { FoodPickerStartStep } from '../../../../shared/components/food-picker/food-picker';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiConfirmSheet } from '../../../../shared/components/ui-confirm-sheet/ui-confirm-sheet';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiProgressBar } from '../../../../shared/components/ui-progress-bar/ui-progress-bar';
import { UiProgressRing } from '../../../../shared/components/ui-progress-ring/ui-progress-ring';
import { UiSpinner } from '../../../../shared/components/ui-spinner/ui-spinner';
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

/** A new custom food clashed with an existing one's name (409). Param `foodName`. */
const DUPLICATE_CUSTOM_FOOD_NOTICE_KEY = 'food.page.duplicateCustomFood';
/** What failed, when the API's error is only the generic "request failed". */
const SAVE_ERROR_KEY = 'food.page.saveError';
const REMOVE_ERROR_KEY = 'food.page.removeError';

/** The page as a whole: the first load, a failed store (food log or profile), or the content. */
type FoodPageStatus = 'loading' | 'error' | 'ready';

/** Why the last save or removal failed – translated live in `notice`. */
interface Failure {
  readonly key: string;
  readonly params?: Readonly<Record<string, string>>;
}

/**
 * The Mad screen: today's calories and macros, the four meal groups and the ways into the log –
 * the "Add food" sheet and the barcode scanner.
 *
 * The page only owns the UI state around the sheet (open, selected meal, food being edited,
 * the running save). All numbers come from `FoodViewService`, and the log is only ever changed
 * through `FoodLogService` – pessimistically: the sheet closes once the API has answered, a
 * failure is shown in the sheet (and under the buttons), and `pending` blocks a second save.
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
    TranslatePipe,
    UiButton,
    UiConfirmSheet,
    UiEmptyState,
    UiFormError,
    UiIcon,
    UiIconButton,
    UiProgressBar,
    UiProgressRing,
    UiSpinner,
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
  private readonly profiles = inject(UserProfileService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly t = injectTranslate();

  protected readonly ringDiameter = KCAL_RING_DIAMETER;
  protected readonly ringStrokeWidth = KCAL_RING_STROKE_WIDTH;

  /** The kcal goal comes from the profile, so its failure is the page's failure too. */
  protected readonly status = computed<FoodPageStatus>(() => {
    const stores = [this.foodLog.status(), this.profiles.status()];
    if (stores.includes('error')) {
      return 'error';
    }
    return stores.includes('loading') ? 'loading' : 'ready';
  });

  protected readonly addOpen = signal(false);
  protected readonly addMeal = signal<MealId>(DEFAULT_MEAL);
  protected readonly editEntry = signal<LoggedFood | null>(null);
  protected readonly pickerStartStep = signal<FoodPickerStartStep>('search');
  protected readonly scannerOpen = signal(false);
  /** The entry the removal confirmation (3.4) asks about. */
  protected readonly removeTarget = signal<LoggedFood | null>(null);
  protected readonly removeOpen = computed(() => this.removeTarget() !== null);
  protected readonly removeParams = computed(() => ({
    foodName: this.removeTarget()?.name ?? '',
  }));
  /** A save or removal is running: its button shows a spinner and further taps are ignored. */
  protected readonly pending = signal(false);
  /** Cleared when the sheet or the scanner opens and when the next action starts. */
  private readonly failure = signal<Failure | null>(null);
  protected readonly notice = computed(() => {
    const failure = this.failure();
    return failure === null ? null : this.t(failure.key, failure.params);
  });

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

  /** "Prøv igen": reloads the store(s) that failed. Not cancelled on leaving, so no store hangs in `loading`. */
  protected retry(): void {
    if (this.foodLog.status() === 'error') {
      this.foodLog.load().subscribe();
    }
    if (this.profiles.status() === 'error') {
      this.profiles.load().subscribe();
    }
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

  /** Only the amount can be changed (spec 3.3). */
  protected openEdit(entry: LoggedFood): void {
    this.failure.set(null);
    this.editEntry.set(entry);
    this.addMeal.set(entry.meal);
    this.pickerStartStep.set('search');
    this.addOpen.set(true);
  }

  protected closeAdd(): void {
    this.addOpen.set(false);
    this.editEntry.set(null);
  }

  /** A finished food from the sheet: update the edited entry, otherwise log it. */
  protected onSelected(item: FoodItem): void {
    const editing = this.editEntry();
    this.run(
      editing ? this.foodLog.update(editing.logId, item) : this.foodLog.add(item, this.addMeal()),
      SAVE_ERROR_KEY,
      () => this.closeAdd(),
    );
  }

  /**
   * A collection from the "Collections" tab: one log row per item, in order (P13).
   * ponytail: a failure midway keeps the rows logged so far; wave 3 logs them in one call
   * (`POST me/meal-collections/{id}/log`).
   */
  protected onCollectionPicked(items: readonly FoodItem[]): void {
    const meal = this.addMeal();
    this.run(
      from(items).pipe(
        concatMap((item) => this.foodLog.add(item, meal)),
        toArray(),
      ),
      SAVE_ERROR_KEY,
      () => this.closeAdd(),
    );
  }

  /** "Gem uden at logge": the picker returns to its search once the food is saved. */
  protected onCustomFoodCreated(item: FoodItem): void {
    this.run(this.foodLog.addCustomFood(item), SAVE_ERROR_KEY);
  }

  // --- Removal (3.4) ---------------------------------------------------------------------------

  protected removeEntry(entry: LoggedFood): void {
    this.failure.set(null);
    this.removeTarget.set(entry);
  }

  protected cancelRemove(): void {
    this.removeTarget.set(null);
  }

  /** The confirmation closes either way; a failure is shown under the buttons. */
  protected confirmRemove(): void {
    const entry = this.removeTarget();
    if (entry) {
      this.run(
        this.foodLog.remove(entry.logId).pipe(finalize(() => this.removeTarget.set(null))),
        REMOVE_ERROR_KEY,
      );
    }
  }

  // --- The scanner -----------------------------------------------------------------------------

  /**
   * The scanner sits on top of the sheet without closing it, so tapping ✕ in the scanner
   * leads back to the sheet – as in the design, where `openScan` doesn't touch `addOpen`.
   */
  protected openScanner(): void {
    this.failure.set(null);
    this.scannerOpen.set(true);
  }

  /** The scanner closes itself; a scanned product becomes the user's own food as it is logged. */
  protected onScanFound(item: FoodItem): void {
    this.run(this.foodLog.add(item, this.addMeal()), SAVE_ERROR_KEY, () => this.closeAdd());
  }

  protected onScanManual(): void {
    this.startAdd(this.addMeal(), 'search');
  }

  /** "Varen har ingen stregkode" – also the way on after "ikke fundet" (3.1-6a → 3.0). */
  protected onScanNoBarcode(): void {
    this.startAdd(this.addMeal(), 'new-food');
  }

  protected onScannerClosed(): void {
    this.scannerOpen.set(false);
  }

  private startAdd(meal: MealId, step: FoodPickerStartStep): void {
    this.failure.set(null);
    this.editEntry.set(null);
    this.addMeal.set(meal);
    this.pickerStartStep.set(step);
    this.addOpen.set(true);
  }

  /** Runs one mutation at a time. Not cancelled when the page closes, so a save is never lost. */
  private run(action: Observable<unknown>, fallbackKey: string, done?: () => void): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    action.pipe(finalize(() => this.pending.set(false))).subscribe({
      next: () => done?.(),
      error: (error: unknown) => this.failure.set(toFailure(error, fallbackKey)),
    });
  }
}

/** The API's generic "request failed" says what failed here; network, server and not-found keep their text. */
function toFailure(error: unknown, fallbackKey: string): Failure {
  if (error instanceof DuplicateCustomFoodNameError) {
    return { key: DUPLICATE_CUSTOM_FOOD_NOTICE_KEY, params: { foodName: error.foodName } };
  }
  const { messageKey } = toApiError(error);
  return { key: messageKey === API_ERROR_MESSAGE_KEY.REQUEST_FAILED ? fallbackKey : messageKey };
}
