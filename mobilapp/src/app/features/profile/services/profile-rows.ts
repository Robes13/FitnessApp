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
import { injectTranslate } from '../../../core/services/language/translate';

import { ProfileEditRowId } from './profile-edit';

export interface ProfileRow {
  readonly id: ProfileEditRowId;
  readonly label: string;
  readonly value: string;
}

/** The design's `'–'` for a value the user hasn't chosen yet. */
const EMPTY_VALUE = '–';

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
  private readonly t = injectTranslate();

  readonly planRows: Signal<readonly ProfileRow[]> = computed(() => {
    const profile = this.profiles.profile();
    const goal = this.profiles.goalDefinition();
    const pace = this.profiles.paceDefinition();
    const frequency = this.profiles.trainingFrequency();
    const rows: ProfileRow[] = [
      {
        id: 'goal',
        label: this.t('profile.rows.goal'),
        value: goal ? this.t(goal.labelKey) : EMPTY_VALUE,
      },
    ];
    const maintains = profile.goal === 'hold';
    if (!maintains) {
      rows.push({
        id: 'pace',
        label: this.t('profile.rows.pace'),
        value: pace ? this.t(pace.rateLabelKey) : EMPTY_VALUE,
      });
    }
    rows.push(
      { id: 'gender', label: this.t('profile.rows.gender'), value: this.genderLabel() },
      {
        id: 'height',
        label: this.t('profile.rows.height'),
        value: this.t('profile.rows.heightValue', { heightCm: Math.round(profile.heightCm) }),
      },
    );
    if (profile.goal !== null && !maintains) {
      rows.push({
        id: 'goalWeight',
        label: this.t('profile.rows.goalWeight'),
        value: this.t('profile.rows.goalWeightValue', { goalWeightKg: this.goalWeightKg() }),
      });
    }
    rows.push(
      {
        id: 'steps',
        label: this.t('profile.rows.steps'),
        value: this.t('profile.rows.stepsValue', {
          steps: formatInteger(profile.stepsPerDay),
          activityLevel: this.t(this.profiles.activityLevel().labelKey),
        }),
      },
      {
        id: 'trainFreq',
        label: this.t('profile.rows.trainFreq'),
        value:
          frequency === 0
            ? this.t('profile.rows.trainFreqNone')
            : this.t('profile.rows.trainFreqValue', { frequency }),
      },
    );
    if (frequency > 0) {
      rows.push(
        {
          id: 'trainDur',
          label: this.t('profile.rows.trainDur'),
          value: this.t('profile.rows.trainDurValue', {
            minutes: Math.round(profile.trainingMinutes),
          }),
        },
        {
          id: 'trainInt',
          label: this.t('profile.rows.trainInt'),
          value: this.intensityLabel(),
        },
      );
    }
    rows.push({
      id: 'kcal',
      label: this.t('profile.rows.kcal'),
      value: this.kcalText(),
    });
    return rows;
  });

  readonly accountRows: Signal<readonly ProfileRow[]> = computed(() => [
    { id: 'email' as const, label: this.t('profile.rows.email'), value: this.email() },
    { id: 'units' as const, label: this.t('profile.rows.units'), value: this.unitsLabel() },
  ]);

  /** The design's `profileEmail`: the placeholder shows until the user has typed their e-mail. */
  readonly email = computed(
    () => this.profiles.profile().email || this.t('profile.rows.emailPlaceholder'),
  );

  readonly weightText = computed(() => formatWeightKg(this.profiles.profile().weightKg));
  readonly heightText = computed(() => String(Math.round(this.profiles.profile().heightCm)));
  /** BMI is always shown with one decimal – the design's `toFixed(1)`. */
  readonly bmiText = computed(() => formatDecimal(this.profiles.bmi(), 1));

  private readonly kcalText = computed(() => {
    const target = formatInteger(this.adaptiveGoal.kcalTarget());
    const adjustment = this.adaptiveGoal.adjustmentKcal();
    return adjustment === 0
      ? this.t('profile.rows.kcalValue', { kcal: target })
      : this.t('profile.rows.kcalValueAdjusted', {
          kcal: target,
          adjustment: formatSignedDecimal(adjustment, 0),
        });
  });

  private readonly genderLabel = computed(() => {
    const gender = this.profiles.profile().gender;
    const definition = GENDERS.find((item) => item.id === gender);
    return definition ? this.t(definition.labelKey) : EMPTY_VALUE;
  });

  private readonly unitsLabel = computed(() => {
    const units = this.profiles.profile().units;
    const definition = UNIT_SYSTEMS.find((item) => item.id === units);
    return definition ? this.t(definition.descriptionKey) : EMPTY_VALUE;
  });

  private readonly intensityLabel = computed(() => {
    const intensity = this.profiles.intensity();
    return intensity ? this.t(intensity.labelKey) : EMPTY_VALUE;
  });

  /** The goal weight is kept within the bounds the goal allows (the design's `gMin`/`gMax`). */
  private readonly goalWeightKg = computed(() => {
    const profile = this.profiles.profile();
    const bounds = this.calculator.goalWeightBounds(profile.goal, profile.weightKg);
    return Math.round(clamp(profile.goalWeightKg, bounds.min, bounds.max));
  });
}
