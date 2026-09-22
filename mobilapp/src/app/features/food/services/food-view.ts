import { Injectable, Signal, computed, inject } from '@angular/core';
import { MEALS } from '../../../core/constants/meals';
import { LoggedFood } from '../../../core/models/food';
import { MealId } from '../../../core/models/meal';
import { FoodLogService } from '../../../core/services/food-log';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator';
import { UserProfileService } from '../../../core/services/user-profile';
import { formatDayLabel } from '../../../core/utils/date-format';
import { NOW } from '../../../core/utils/now';
import { ProgressBarTone } from '../../../shared/components/ui-progress-bar/ui-progress-bar';

/** Måltidet arket åbner på, når brugeren ikke selv har valgt et (designets `addMeal || 'morgen'`). */
export const DEFAULT_MEAL: MealId = 'morgen';

/** Designets `ml.kcalText`, når måltidet er tomt. */
const NO_KCAL_TEXT = '–';

/** Én af de tre makroer på Mad-skærmen. `key` peger ind i `Macros`. */
interface MacroDefinition {
  readonly key: 'protein' | 'carbs' | 'fat';
  readonly label: string;
  readonly tone: ProgressBarTone;
}

/** Designets `macros`: Protein orange, Kulhydrat blå (`selected`), Fedt grå (`secondary`). */
const MACRO_DEFINITIONS: readonly MacroDefinition[] = [
  { key: 'protein', label: 'Protein', tone: 'accent' },
  { key: 'carbs', label: 'Kulhydrat', tone: 'selected' },
  { key: 'fat', label: 'Fedt', tone: 'secondary' },
];

export interface MacroCardView {
  readonly key: string;
  readonly label: string;
  /** Andel af dagsmålet, 0..1 (klemt fast), til `UiProgressBar`. */
  readonly progress: number;
  /** Designets `m.pct`, fx `'62%'`. */
  readonly percentLabel: string;
  /** Designets `m.text`, fx `'92 / 150 g'`. */
  readonly text: string;
  readonly tone: ProgressBarTone;
}

export interface MealGroupView {
  readonly id: MealId;
  readonly label: string;
  /** Designets `+ Tilføj til {{ ml.lower }}`. */
  readonly addLabel: string;
  readonly entries: readonly LoggedFood[];
  /** `'420 kcal'` eller `'–'`, når måltidet er tomt. */
  readonly kcalText: string;
  readonly hasKcal: boolean;
}

/**
 * De afledte værdier på Mad-skærmen (designets `kcalRing`, `macros` og `meals`).
 *
 * Servicen ejer ingen state – den læser `FoodLogService` og `UserProfileService` og regner
 * videre med `computed()`, så siden kun indeholder præsentation. Den provides på ruten
 * (`FOOD_ROUTES`), fordi værdierne kun bruges af denne feature.
 */
@Injectable()
export class FoodViewService {
  private readonly foodLog = inject(FoodLogService);
  private readonly userProfile = inject(UserProfileService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);

  /** Designets `todayLabel`, fx `'Mandag 21. sep'`. Dagen skifter ikke, mens skærmen er åben. */
  readonly todayLabel = formatDayLabel(this.now());

  readonly kcalTarget: Signal<number> = this.userProfile.kcalTarget;
  readonly kcalEaten = computed(() => this.foodLog.totals().kcal);
  /** Mål − spist. Må være negativ: scannerens verdict regner videre på den. */
  readonly kcalRemaining = computed(() => this.kcalTarget() - this.kcalEaten());
  /** Designets `kcalLeft`: aldrig under 0 i selve tallet på skærmen. */
  readonly kcalLeft = computed(() => Math.max(0, this.kcalRemaining()));
  /** Designets `kcalRing` omskrevet til en andel 0..1. */
  readonly kcalProgress = computed(() => fraction(this.kcalEaten(), this.kcalTarget()));

  readonly macroCards = computed<readonly MacroCardView[]>(() => {
    const goals = this.calculator.macroGoals(this.kcalTarget());
    const totals = this.foodLog.totals();
    return MACRO_DEFINITIONS.map(({ key, label, tone }) => {
      const value = totals[key];
      const goal = goals[key];
      const progress = fraction(value, goal);
      return {
        key,
        label,
        tone,
        progress,
        percentLabel: `${Math.round(progress * PERCENT)}%`,
        text: `${value} / ${goal} g`,
      };
    });
  });

  readonly mealGroups = computed<readonly MealGroupView[]>(() => {
    const byMeal = this.foodLog.byMeal();
    return MEALS.map((meal) => {
      const entries = byMeal.get(meal.id) ?? [];
      const kcal = entries.reduce((sum, entry) => sum + entry.kcal, 0);
      return {
        id: meal.id,
        label: meal.label,
        addLabel: `+ Tilføj til ${meal.label.toLowerCase()}`,
        entries,
        kcalText: kcal > 0 ? `${kcal} kcal` : NO_KCAL_TEXT,
        hasKcal: kcal > 0,
      };
    });
  });

  mealLabel(id: MealId): string {
    return MEALS.find((meal) => meal.id === id)?.label ?? '';
  }
}

const PERCENT = 100;

/** Andel 0..1 af et mål. Et mål på 0 giver 0 i stedet for `Infinity`/`NaN`. */
function fraction(value: number, goal: number): number {
  return goal > 0 ? Math.min(1, value / goal) : 0;
}
