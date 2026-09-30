import { Injectable, inject } from '@angular/core';
import {
  GENDERS,
  GOALS,
  INTENSITIES,
  KCAL_MAX,
  KCAL_MIN,
  PACES,
  STEPS_MAX,
  STEPS_MIN,
  TRAINING_MAX_MINUTES,
  TRAINING_MIN_MINUTES,
  UNIT_SYSTEMS,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from '../../../core/constants/nutrition';
import { GoalId } from '../../../core/models/profile';
import { AdaptiveGoalService } from '../../../core/services/adaptive-goal/adaptive-goal';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator/nutrition-calculator';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import {
  formatInteger,
  formatSignedDecimal,
  formatWeightKg,
} from '../../../core/utils/date-format';
import { injectTranslate } from '../../../core/services/language/translate';

/** The rows in Profile that can be edited. The ids are the design's `editDefs` keys. */
export const PROFILE_EDIT_ROWS = [
  'goal',
  'pace',
  'gender',
  'height',
  'goalWeight',
  'steps',
  'trainFreq',
  'trainDur',
  'trainInt',
  'kcal',
  'email',
  'units',
] as const;

export type ProfileEditRowId = (typeof PROFILE_EDIT_ROWS)[number];

export interface ProfileEditOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

interface BaseEditDefinition {
  readonly id: ProfileEditRowId;
  readonly title: string;
  /** Empty string = no hint text. */
  readonly hint: string;
}

export interface OptionsEditDefinition extends BaseEditDefinition {
  readonly kind: 'options';
  readonly options: readonly ProfileEditOption[];
  readonly selectedId: string | null;
}

export interface NumberEditDefinition extends BaseEditDefinition {
  readonly kind: 'number';
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
}

export interface TextEditDefinition extends BaseEditDefinition {
  readonly kind: 'text';
  readonly placeholder: string;
  readonly value: string;
}

export type ProfileEditDefinition =
  OptionsEditDefinition | NumberEditDefinition | TextEditDefinition;

/**
 * What happened when an option was picked. A new goal ("tabe"/"tage") that the stored goal
 * weight no longer fits is **not** saved – the sheet must ask for a new goal weight first
 * and then save both with `applyGoalWithGoalWeight()`.
 */
export type OptionApplyResult =
  { readonly kind: 'saved' } | { readonly kind: 'needs-goal-weight'; readonly goal: GoalId };

/**
 * The design's `editDefs` uses a narrower height range than the ruler in the sign-up flow
 * (`HEIGHT_MIN_CM`/`HEIGHT_MAX_CM`), because this field is typed with the keyboard.
 */
const HEIGHT_EDIT_MIN_CM = 120;
const HEIGHT_EDIT_MAX_CM = 230;

const HEIGHT_STEP_CM = 1;
const GOAL_WEIGHT_STEP_KG = 1;
const STEPS_STEP = 500;
const TRAINING_DAYS_PER_WEEK = 7;
const TRAINING_FREQUENCY_STEP = 1;
const TRAINING_MINUTES_STEP = 5;
const KCAL_STEP = 50;

/** The same two warnings as the sign-up flow's goal-weight step. */
const GOAL_WEIGHT_TOO_LOW_KEY = 'profile.edit.goalWeightTooLow';
const GOAL_WEIGHT_TOO_HIGH_KEY = 'profile.edit.goalWeightTooHigh';

const SAVED: OptionApplyResult = { kind: 'saved' };

/**
 * The definitions behind the "Rediger profil" sheet: what a row is called, what kind of
 * field it shows, and what happens when the user saves. A port of the design's
 * `editDefs`/`openEdit`.
 */
@Injectable({ providedIn: 'root' })
export class ProfileEditService {
  private readonly profiles = inject(UserProfileService);
  private readonly adaptiveGoal = inject(AdaptiveGoalService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly t = injectTranslate();

  definitionFor(row: ProfileEditRowId): ProfileEditDefinition {
    const profile = this.profiles.profile();
    switch (row) {
      case 'goal':
        return {
          id: row,
          title: this.t('profile.edit.goalTitle'),
          hint: '',
          kind: 'options',
          selectedId: profile.goal,
          options: GOALS.map((goal) => ({
            id: goal.id,
            label: this.t(goal.labelKey),
            description: this.t(goal.descriptionKey),
          })),
        };
      case 'pace':
        return {
          id: row,
          title: this.t('profile.edit.paceTitle'),
          hint: '',
          kind: 'options',
          selectedId: profile.pace,
          options: PACES.map((pace) => ({
            id: pace.id,
            label: this.t(pace.labelKey),
            description: `${this.t(pace.rateLabelKey)} · ${this.t(pace.descriptionKey)}`,
          })),
        };
      case 'gender':
        return {
          id: row,
          title: this.t('profile.edit.genderTitle'),
          hint: '',
          kind: 'options',
          selectedId: profile.gender,
          options: GENDERS.map((gender) => ({
            id: gender.id,
            label: this.t(gender.labelKey),
            description: '',
          })),
        };
      case 'units':
        return {
          id: row,
          title: this.t('profile.edit.unitsTitle'),
          hint: '',
          kind: 'options',
          selectedId: profile.units,
          options: UNIT_SYSTEMS.map((unit) => ({
            id: unit.id,
            label: this.t(unit.labelKey),
            description: this.t(unit.descriptionKey),
          })),
        };
      case 'trainInt':
        return {
          id: row,
          title: this.t('profile.edit.intensityTitle'),
          hint: '',
          kind: 'options',
          selectedId: this.profiles.intensity()?.id ?? null,
          options: INTENSITIES.map((intensity) => ({
            id: intensity.id,
            label: this.t(intensity.labelKey),
            description: this.t(intensity.talkTestKey),
          })),
        };
      case 'height':
        return {
          id: row,
          title: this.t('profile.edit.heightTitle'),
          hint: '',
          kind: 'number',
          unit: this.t('common.unit.cm'),
          min: HEIGHT_EDIT_MIN_CM,
          max: HEIGHT_EDIT_MAX_CM,
          step: HEIGHT_STEP_CM,
          value: Math.round(profile.heightCm),
        };
      case 'goalWeight':
        return this.goalWeightDefinition(profile.goal);
      case 'steps':
        return {
          id: row,
          title: this.t('profile.edit.stepsTitle'),
          hint: this.t('profile.edit.stepsHint'),
          kind: 'number',
          unit: this.t('profile.edit.stepsUnit'),
          min: STEPS_MIN,
          max: STEPS_MAX,
          step: STEPS_STEP,
          value: Math.round(profile.stepsPerDay),
        };
      case 'trainFreq':
        return {
          id: row,
          title: this.t('profile.edit.trainFreqTitle'),
          hint: this.t('profile.edit.trainFreqHint'),
          kind: 'number',
          unit: this.t('profile.edit.trainFreqUnit'),
          min: 0,
          max: TRAINING_DAYS_PER_WEEK,
          step: TRAINING_FREQUENCY_STEP,
          value: this.profiles.trainingFrequency(),
        };
      case 'trainDur':
        return {
          id: row,
          title: this.t('profile.edit.trainDurTitle'),
          hint: '',
          kind: 'number',
          unit: this.t('profile.edit.trainDurUnit'),
          min: TRAINING_MIN_MINUTES,
          max: TRAINING_MAX_MINUTES,
          step: TRAINING_MINUTES_STEP,
          value: Math.round(profile.trainingMinutes),
        };
      case 'kcal':
        return {
          id: row,
          title: this.t('profile.edit.kcalTitle'),
          hint: this.kcalHint(),
          kind: 'number',
          unit: this.t('common.unit.kcal'),
          min: KCAL_MIN,
          max: KCAL_MAX,
          step: KCAL_STEP,
          value: this.adaptiveGoal.kcalTarget(),
        };
      case 'email':
        return {
          id: row,
          title: this.t('profile.edit.emailTitle'),
          hint: '',
          kind: 'text',
          placeholder: this.t('profile.edit.emailPlaceholder'),
          value: profile.email,
        };
    }
  }

  /**
   * The suggestion behind the kcal row, with the adjustment spelled out when it actually changes
   * the suggestion (after the 1200 kcal floor).
   */
  private kcalHint(): string {
    const suggestion = formatInteger(this.adaptiveGoal.suggestedKcalTarget());
    const adjustment = this.adaptiveGoal.suggestedAdjustmentKcal();
    return adjustment === 0
      ? this.t('profile.edit.kcalHint', { kcal: suggestion })
      : this.t('profile.edit.kcalHintAdjusted', {
          kcal: suggestion,
          adjustment: formatSignedDecimal(adjustment, 0),
        });
  }

  /**
   * The goal weight row for `goal`. The bounds are the same scale as in the sign-up flow
   * (`NutritionCalculator.goalWeightBounds`): below today's weight when losing, above it when
   * gaining. With `pendingGoal` the row is shown while switching to that goal, and the hint
   * explains why a new goal weight is needed.
   */
  goalWeightDefinition(goal: GoalId | null, pendingGoal = false): NumberEditDefinition {
    const profile = this.profiles.profile();
    const bounds =
      goal === 'tabe' || goal === 'tage'
        ? this.calculator.goalWeightBounds(goal, profile.weightKg)
        : { min: WEIGHT_MIN_KG, max: WEIGHT_MAX_KG };
    const current = formatWeightKg(profile.weightKg);
    const goalDefinition = GOALS.find((item) => item.id === goal);
    const goalLabel = goalDefinition ? this.t(goalDefinition.labelKey) : '';
    return {
      id: 'goalWeight',
      title: this.t('profile.edit.goalWeightTitle'),
      hint: pendingGoal
        ? this.t('profile.edit.goalWeightHintPending', { goal: goalLabel, currentKg: current })
        : this.t('profile.edit.goalWeightHint', { currentKg: current }),
      kind: 'number',
      unit: this.t('common.unit.kg'),
      min: bounds.min,
      max: bounds.max,
      step: GOAL_WEIGHT_STEP_KG,
      value: Math.round(profile.goalWeightKg),
    };
  }

  /**
   * Why `goalWeightKg` isn't a valid goal weight for `goal` – or `null` when it is. The
   * rules match the sign-up flow: below today's weight when losing, above it when gaining,
   * and never an unrealistic BMI (`NutritionCalculator.isGoalWeightRealistic`).
   */
  goalWeightError(
    goalWeightKg: number,
    goal: GoalId | null = this.profiles.profile().goal,
  ): string | null {
    if (goal !== 'tabe' && goal !== 'tage') {
      return null;
    }
    const profile = this.profiles.profile();
    const bounds = this.calculator.goalWeightBounds(goal, profile.weightKg);
    const current = formatWeightKg(profile.weightKg);
    if (goal === 'tabe' && goalWeightKg > bounds.max) {
      return this.t('profile.edit.goalWeightBelowCurrent', { currentKg: current });
    }
    if (goal === 'tage' && goalWeightKg < bounds.min) {
      return this.t('profile.edit.goalWeightAboveCurrent', { currentKg: current });
    }
    if (!this.calculator.isGoalWeightRealistic(goal, goalWeightKg, profile.heightCm)) {
      return this.t(goal === 'tabe' ? GOAL_WEIGHT_TOO_LOW_KEY : GOAL_WEIGHT_TOO_HIGH_KEY);
    }
    if (goalWeightKg < bounds.min || goalWeightKg > bounds.max) {
      return this.t('profile.edit.goalWeightRange', { min: bounds.min, max: bounds.max });
    }
    return null;
  }

  /** Saves a goal change together with the new goal weight it required. */
  applyGoalWithGoalWeight(goal: GoalId, goalWeightKg: number): boolean {
    const rounded = Math.round(goalWeightKg);
    if (this.goalWeightError(rounded, goal) !== null) {
      return false;
    }
    this.profiles.update({ goal, goalWeightKg: rounded });
    return true;
  }

  /**
   * A choice in an options sheet is saved immediately, as in the design. The id is looked
   * up in the definition list, so an unknown string can never end up in the profile.
   * The exception is a goal the stored goal weight doesn't fit – see `OptionApplyResult`.
   */
  applyOption(row: ProfileEditRowId, optionId: string): OptionApplyResult {
    switch (row) {
      case 'goal': {
        const goal = GOALS.find((item) => item.id === optionId);
        if (!goal) {
          return SAVED;
        }
        const goalWeightKg = Math.round(this.profiles.profile().goalWeightKg);
        if (this.goalWeightError(goalWeightKg, goal.id) !== null) {
          return { kind: 'needs-goal-weight', goal: goal.id };
        }
        this.profiles.update({ goal: goal.id });
        return SAVED;
      }
      case 'pace': {
        const pace = PACES.find((item) => item.id === optionId);
        if (pace) {
          this.profiles.update({ pace: pace.id });
        }
        return SAVED;
      }
      case 'gender': {
        const gender = GENDERS.find((item) => item.id === optionId);
        if (gender) {
          this.profiles.update({ gender: gender.id });
        }
        return SAVED;
      }
      case 'units': {
        const units = UNIT_SYSTEMS.find((item) => item.id === optionId);
        if (units) {
          this.profiles.update({ units: units.id });
        }
        return SAVED;
      }
      case 'trainInt': {
        const intensity = INTENSITIES.find((item) => item.id === optionId);
        if (intensity) {
          this.profiles.update({ trainingRpe: intensity.rpe });
        }
        return SAVED;
      }
      default:
        return SAVED;
    }
  }

  /** Returns `false` when the value was rejected (a goal weight that breaks the goal's rules). */
  applyNumber(row: ProfileEditRowId, value: number): boolean {
    const rounded = Math.round(value);
    switch (row) {
      case 'height':
        this.profiles.update({ heightCm: rounded });
        return true;
      case 'goalWeight':
        if (this.goalWeightError(rounded) !== null) {
          return false;
        }
        this.profiles.update({ goalWeightKg: rounded });
        return true;
      case 'steps':
        this.profiles.update({ stepsPerDay: rounded });
        return true;
      case 'trainFreq':
        this.profiles.update({ trainingDays: trainingDaysFor(rounded) });
        return true;
      case 'trainDur':
        this.profiles.update({ trainingMinutes: rounded });
        return true;
      case 'kcal':
        this.profiles.update({ kcalOverride: rounded });
        return true;
      default:
        return true;
    }
  }

  applyEmail(value: string): void {
    this.profiles.update({ email: value.trim() });
  }
}

/** The design's `trainFreq.apply`: the first `count` weekdays are marked as training days. */
function trainingDaysFor(count: number): readonly boolean[] {
  return Array.from({ length: TRAINING_DAYS_PER_WEEK }, (_, index) => index < count);
}
