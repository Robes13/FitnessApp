import { Injectable, Signal, computed, inject } from '@angular/core';
import { GENDERS } from '../../../core/constants/nutrition';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator/nutrition-calculator';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import {
  formatDayMonth,
  formatDecimal,
  formatInteger,
  formatWeightKg,
  fromIsoDate,
} from '../../../core/utils/date-format';
import { clamp } from '../../../core/utils/math';
import { injectTranslate } from '../../../core/services/language/translate';

import { ProfileEditRowId } from './profile-edit';

/** A row opens the edit sheet – except the calorie target, which is the API's (`editable: false`). */
export type ProfileRow =
  | {
      readonly id: ProfileEditRowId;
      readonly label: string;
      readonly value: string;
      readonly editable?: true;
    }
  | {
      readonly id: 'kcal';
      readonly label: string;
      readonly value: string;
      readonly editable: false;
    };

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
 * "Dagligt kaloriemål" is the API's target (calculated from the profile and goal) and can't be
 * edited; when the API has lifted it to its safe minimum, the value says so
 * ("1.200 kcal · sikkert minimum").
 */
@Injectable({ providedIn: 'root' })
export class ProfileRowsService {
  private readonly profiles = inject(UserProfileService);
  private readonly calculator = inject(NutritionCalculator);
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
      { id: 'birthday', label: this.t('profile.rows.birthday'), value: this.birthdayLabel() },
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
      editable: false,
    });
    return rows;
  });

  readonly accountRows: Signal<readonly ProfileRow[]> = computed(() => [
    { id: 'email', label: this.t('profile.rows.email'), value: this.email() },
  ]);

  /** The design's `profileEmail`: the placeholder shows until the user has typed their e-mail. */
  readonly email = computed(
    () => this.profiles.profile().email || this.t('profile.rows.emailPlaceholder'),
  );

  readonly weightText = computed(() => formatWeightKg(this.profiles.profile().weightKg));
  readonly heightText = computed(() => String(Math.round(this.profiles.profile().heightCm)));
  /** BMI is always shown with one decimal – the design's `toFixed(1)`. */
  readonly bmiText = computed(() => formatDecimal(this.profiles.bmi(), 1));

  private readonly kcalText = computed(() =>
    this.t(
      this.profiles.calorieFloorApplied()
        ? 'profile.rows.kcalValueFloor'
        : 'profile.rows.kcalValue',
      { kcal: formatInteger(this.profiles.targets().kcal) },
    ),
  );

  /** "16. maj 1998 · 28 år". */
  private readonly birthdayLabel = computed(() => {
    const birthday = this.profiles.profile().birthday;
    if (birthday === null) {
      return EMPTY_VALUE;
    }
    const date = fromIsoDate(birthday);
    return this.t('profile.rows.birthdayValue', {
      date: formatDayMonth(this.t, date),
      year: date.getFullYear(),
      age: this.profiles.age(),
    });
  });

  private readonly genderLabel = computed(() => {
    const gender = this.profiles.profile().gender;
    const definition = GENDERS.find((item) => item.id === gender);
    return definition ? this.t(definition.labelKey) : EMPTY_VALUE;
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
