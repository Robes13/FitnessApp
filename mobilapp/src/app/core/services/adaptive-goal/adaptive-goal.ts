import { Injectable, Signal, computed, inject } from '@angular/core';
import { ADAPTIVE_WINDOW_DAYS } from '../../constants/nutrition';
import { AdaptiveAdjustment } from '../../models/nutrition';
import { addDays, fromIsoDate } from '../../utils/date-format';
import { FoodLogService } from '../food-log/food-log';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';
import { UserProfileService } from '../user-profile/user-profile';
import { WeightLogService } from '../weight-log/weight-log';

/**
 * The daily calorie target the app shows and measures against: the formula target from the
 * profile, adapted to the user's logged intake and weight trend over the last
 * `ADAPTIVE_WINDOW_DAYS` completed days (see `NutritionCalculator.adaptiveAdjustment`).
 *
 * A manual `kcalOverride` always wins; then `adjustmentKcal` is 0. Today is left out of the
 * window – both its intake and its weigh-ins – because a day that is still being logged would
 * pull the average down, and intake and weight should cover the same days.
 *
 * "Today" is `FoodLogService.today`, a signal, so the target moves on at midnight.
 */
@Injectable({ providedIn: 'root' })
export class AdaptiveGoalService {
  private readonly profiles = inject(UserProfileService);
  private readonly foodLog = inject(FoodLogService);
  private readonly weightLog = inject(WeightLogService);
  private readonly calculator = inject(NutritionCalculator);

  /** Local midnight of today; changes when the date does. */
  private readonly today = computed(() => fromIsoDate(this.foodLog.today()));

  /** The estimate behind the adjustment, or `null` when there is too little data. */
  readonly adjustment: Signal<AdaptiveAdjustment | null> = computed(() => {
    const today = this.today();
    const from = addDays(today, -ADAPTIVE_WINDOW_DAYS);
    const fromTime = from.getTime();
    const todayTime = today.getTime();
    return this.calculator.adaptiveAdjustment({
      formulaTdeeKcal: this.calculator.maintenanceKcal(this.profiles.profile(), today),
      dailyTotals: this.foodLog.dailyTotals(from, addDays(today, -1)),
      weighIns: this.weightLog.entries().filter((entry) => {
        const time = new Date(entry.at).getTime();
        return time >= fromTime && time < todayTime;
      }),
    });
  });

  /** The calculated suggestion including the adaptive adjustment (ignores the override). */
  readonly suggestedKcalTarget: Signal<number> = computed(() =>
    this.calculator.suggestedKcalTarget(
      this.profiles.profile(),
      this.today(),
      this.adjustment()?.adjustmentKcal ?? 0,
    ),
  );

  /**
   * The kcal the adjustment actually moves the suggestion, after the `KCAL_MIN` floor: a -300
   * adjustment on a suggestion already at the floor applies 0. Ignores the override.
   */
  readonly suggestedAdjustmentKcal: Signal<number> = computed(
    () =>
      this.suggestedKcalTarget() -
      this.calculator.suggestedKcalTarget(this.profiles.profile(), this.today()),
  );

  /** The kcal actually added to the target. 0 without enough data or with a manual target. */
  readonly adjustmentKcal: Signal<number> = computed(() =>
    this.profiles.profile().kcalOverride === null ? this.suggestedAdjustmentKcal() : 0,
  );

  /** The daily calorie target: the manual override, otherwise the adapted suggestion. */
  readonly kcalTarget: Signal<number> = computed(
    () => this.profiles.profile().kcalOverride ?? this.suggestedKcalTarget(),
  );
}
