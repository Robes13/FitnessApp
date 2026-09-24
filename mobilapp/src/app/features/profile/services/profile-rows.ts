import { Injectable, Signal, computed, inject } from '@angular/core';
import { GENDERS, UNIT_SYSTEMS } from '../../../core/constants/nutrition';
import { AdaptiveGoalService } from '../../../core/services/adaptive-goal/adaptive-goal';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator/nutrition-calculator';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import {
  formatDecimal,
  formatInteger,
  formatSignedDecimal,
  formatWeightKg,
} from '../../../core/utils/date-format';
import { clamp } from '../../../core/utils/math';

import { ProfileEditRowId } from './profile-edit';

export interface ProfileRow {
  readonly id: ProfileEditRowId;
  readonly label: string;
  readonly value: string;
}

/** The design's `'–'` for a value the user hasn't chosen yet. */
const EMPTY_VALUE = '–';
const PASSWORD_MASK = '••••••••';

/**
 * The rows under "Min plan" and "Konto" on the profile page – the design's `profileRows`
 * and `accountRows`.
 *
 * Four rows are conditional: "Målvægt" only shows when a goal is chosen and it isn't
 * "maintain weight", "Tempo" is hidden for "maintain weight" (as in the sign-up flow, where
 * pace doesn't change the target), and "Længde"/"Intensitet" only show when the user has at
 * least one training day.
 *
 * "Dagligt kaloriemål" is the adapted target; when the intake/weight trend moves it, the value
 * also says by how much (e.g. "2.410 kcal · tilpasset −120").
 */
@Injectable({ providedIn: 'root' })
export class ProfileRowsService {
  private readonly profiles = inject(UserProfileService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly adaptiveGoal = inject(AdaptiveGoalService);

  readonly planRows: Signal<readonly ProfileRow[]> = computed(() => {
    const profile = this.profiles.profile();
    const goal = this.profiles.goalDefinition();
    const pace = this.profiles.paceDefinition();
    const frequency = this.profiles.trainingFrequency();
    const rows: ProfileRow[] = [{ id: 'goal', label: 'Mål', value: goal?.label ?? EMPTY_VALUE }];
    const maintains = profile.goal === 'hold';
    if (!maintains) {
      rows.push({ id: 'pace', label: 'Tempo', value: pace?.rateLabel ?? EMPTY_VALUE });
    }
    rows.push(
      { id: 'gender', label: 'Køn', value: this.genderLabel() },
      { id: 'height', label: 'Højde', value: `${Math.round(profile.heightCm)} cm` },
    );
    if (profile.goal !== null && !maintains) {
      rows.push({ id: 'goalWeight', label: 'Målvægt', value: `${this.goalWeightKg()} kg` });
    }
    rows.push(
      {
        id: 'steps',
        label: 'Aktivitet',
        value: `${formatInteger(profile.stepsPerDay)} skridt · ${this.profiles.activityLevel().label}`,
      },
      {
        id: 'trainFreq',
        label: 'Træningsdage',
        value: frequency === 0 ? 'Ingen' : `${frequency} / uge`,
      },
    );
    if (frequency > 0) {
      rows.push(
        { id: 'trainDur', label: 'Længde', value: `${Math.round(profile.trainingMinutes)} min` },
        {
          id: 'trainInt',
          label: 'Intensitet',
          value: this.profiles.intensity()?.label ?? EMPTY_VALUE,
        },
      );
    }
    rows.push({
      id: 'kcal',
      label: 'Dagligt kaloriemål',
      value: this.kcalText(),
    });
    return rows;
  });

  readonly accountRows: Signal<readonly ProfileRow[]> = computed(() => [
    { id: 'email' as const, label: 'E-mail', value: this.email() },
    { id: 'password' as const, label: 'Adgangskode', value: PASSWORD_MASK },
    { id: 'units' as const, label: 'Enheder', value: this.unitsLabel() },
  ]);

  /** The design's `profileEmail`: the placeholder shows until the user has typed their e-mail. */
  readonly email = computed(() => this.profiles.profile().email || 'dig@mail.dk');

  readonly weightText = computed(() => formatWeightKg(this.profiles.profile().weightKg));
  readonly heightText = computed(() => String(Math.round(this.profiles.profile().heightCm)));
  /** BMI is always shown with one decimal – the design's `toFixed(1)`. */
  readonly bmiText = computed(() => formatDecimal(this.profiles.bmi(), 1));

  private readonly kcalText = computed(() => {
    const target = `${formatInteger(this.adaptiveGoal.kcalTarget())} kcal`;
    const adjustment = this.adaptiveGoal.adjustmentKcal();
    return adjustment === 0
      ? target
      : `${target} · tilpasset ${formatSignedDecimal(adjustment, 0)}`;
  });

  private readonly genderLabel = computed(() => {
    const gender = this.profiles.profile().gender;
    return GENDERS.find((item) => item.id === gender)?.label ?? EMPTY_VALUE;
  });

  private readonly unitsLabel = computed(() => {
    const units = this.profiles.profile().units;
    return UNIT_SYSTEMS.find((item) => item.id === units)?.description ?? EMPTY_VALUE;
  });

  /** The goal weight is kept within the bounds the goal allows (the design's `gMin`/`gMax`). */
  private readonly goalWeightKg = computed(() => {
    const profile = this.profiles.profile();
    const bounds = this.calculator.goalWeightBounds(profile.goal, profile.weightKg);
    return Math.round(clamp(profile.goalWeightKg, bounds.min, bounds.max));
  });
}
