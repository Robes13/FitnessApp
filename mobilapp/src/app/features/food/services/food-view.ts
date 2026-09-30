import { Injectable, Signal, computed, inject } from '@angular/core';
import { MEALS } from '../../../core/constants/meals';
import { LoggedFood } from '../../../core/models/food';
import { MealId } from '../../../core/models/meal';
import { AdaptiveGoalService } from '../../../core/services/adaptive-goal/adaptive-goal';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator/nutrition-calculator';
import { formatDayLabel, formatGrams } from '../../../core/utils/date-format';
import { NOW } from '../../../core/utils/now';
import { injectTranslate } from '../../../core/services/language/translate';
import { ProgressBarTone } from '../../../shared/components/ui-progress-bar/ui-progress-bar';

/** The meal the sheet opens on when the user hasn't selected one themselves (the design's `addMeal || 'morgen'`). */
export const DEFAULT_MEAL: MealId = 'morgen';

/** The design's `ml.kcalText` when the meal is empty. */
const NO_KCAL_TEXT = '–';

/** One of the three macros on the Mad screen. `key` points into `Macros`. */
interface MacroDefinition {
  readonly key: 'protein' | 'carbs' | 'fat';
  readonly labelKey: string;
  readonly tone: ProgressBarTone;
}

/** The design's `macros`: Protein orange, Carbs blue (`selected`), Fat gray (`secondary`). */
const MACRO_DEFINITIONS: readonly MacroDefinition[] = [
  { key: 'protein', labelKey: 'food.view.protein', tone: 'accent' },
  { key: 'carbs', labelKey: 'food.view.carbs', tone: 'selected' },
  { key: 'fat', labelKey: 'food.view.fat', tone: 'secondary' },
];

export interface MacroCardView {
  readonly key: string;
  readonly label: string;
  /** Share of the daily target, 0..1 (clamped), for `UiProgressBar`. */
  readonly progress: number;
  /** The design's `m.pct`, e.g. `'62%'`. */
  readonly percentLabel: string;
  /** The design's `m.text`, e.g. `'92 / 150 g'`. */
  readonly text: string;
  readonly tone: ProgressBarTone;
}

export interface MealGroupView {
  readonly id: MealId;
  readonly label: string;
  /** The design's `+ Tilføj til {{ ml.lower }}`. */
  readonly addLabel: string;
  readonly entries: readonly LoggedFood[];
  /** `'420 kcal'` or `'–'`, when the meal is empty. */
  readonly kcalText: string;
  readonly hasKcal: boolean;
}

/**
 * The derived values on the Mad screen (the design's `kcalRing`, `macros` and `meals`).
 *
 * The service owns no state – it reads `FoodLogService` and `AdaptiveGoalService` and computes
 * further with `computed()`, so the page only contains presentation. It's provided on the route
 * (`FOOD_ROUTES`), because the values are only used by this feature.
 */
@Injectable()
export class FoodViewService {
  private readonly foodLog = inject(FoodLogService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);
  private readonly t = injectTranslate();

  /** The design's `todayLabel`, e.g. `'Mandag 21. sep'`. The day doesn't change while the screen is open. */
  readonly todayLabel = computed(() => formatDayLabel(this.t, this.now()));

  readonly kcalTarget: Signal<number> = inject(AdaptiveGoalService).kcalTarget;
  readonly kcalEaten = computed(() => this.foodLog.totals().kcal);
  /** Target − eaten. Can be negative: the scanner's verdict computes further on it. */
  readonly kcalRemaining = computed(() => this.kcalTarget() - this.kcalEaten());
  /** The design's `kcalLeft`: never below 0 in the actual number on screen. */
  readonly kcalLeft = computed(() => Math.max(0, this.kcalRemaining()));
  /** The design's `kcalRing` rewritten as a share 0..1. */
  readonly kcalProgress = computed(() => fraction(this.kcalEaten(), this.kcalTarget()));

  readonly macroCards = computed<readonly MacroCardView[]>(() => {
    const goals = this.calculator.macroGoals(this.kcalTarget());
    const totals = this.foodLog.totals();
    return MACRO_DEFINITIONS.map(({ key, labelKey, tone }) => {
      const value = totals[key];
      const goal = goals[key];
      const progress = fraction(value, goal);
      return {
        key,
        label: this.t(labelKey),
        tone,
        progress,
        percentLabel: `${Math.round(progress * PERCENT)}%`,
        text: this.t('food.view.macroProgress', { eaten: formatGrams(value), goal }),
      };
    });
  });

  readonly mealGroups = computed<readonly MealGroupView[]>(() => {
    const byMeal = this.foodLog.byMeal();
    return MEALS.map((meal) => {
      const entries = byMeal.get(meal.id) ?? [];
      const kcal = entries.reduce((sum, entry) => sum + entry.kcal, 0);
      const label = this.t(meal.labelKey);
      return {
        id: meal.id,
        label,
        addLabel: this.t('food.view.addTo', { mealName: label.toLowerCase() }),
        entries,
        kcalText: kcal > 0 ? `${kcal} ${this.t('common.unit.kcal')}` : NO_KCAL_TEXT,
        hasKcal: kcal > 0,
      };
    });
  });

  mealLabel(id: MealId): string {
    const meal = MEALS.find((candidate) => candidate.id === id);
    return meal ? this.t(meal.labelKey) : '';
  }
}

const PERCENT = 100;

/** Share 0..1 of a target. A target of 0 gives 0 instead of `Infinity`/`NaN`. */
function fraction(value: number, goal: number): number {
  return goal > 0 ? Math.min(1, value / goal) : 0;
}
