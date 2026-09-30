import { Injectable } from '@angular/core';
import { injectTranslate } from '../language/translate';
import {
  ACTIVITY_LEVELS,
  DEFAULT_QUANTITY_UNIT,
  GOAL_BMI_MAX,
  GOAL_BMI_MIN,
  GOAL_WEIGHT_MAX_KG,
  GOAL_WEIGHT_MIN_KG,
  GOAL_WEIGHT_MIN_SPAN_KG,
  INTENSITIES,
  KCAL_PER_STEP_PER_KG,
  KM_PER_STEP,
  PACES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRONG_LENGTH,
  RPE_MAX,
  RPE_MIN,
  STEPS_MAX,
  STEPS_MIN,
} from '../../constants/nutrition';
import { Macros } from '../../models/food';
import { GoalWeightBounds, ParsedQuantity, PasswordStrength } from '../../models/nutrition';
import {
  ActivityLevel,
  GoalId,
  IntensityDefinition,
  PaceDefinition,
  UserProfile,
} from '../../models/profile';
import { clamp, roundTo } from '../../utils/math';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const UPPERCASE_PATTERN = /[A-ZÆØÅ]/;
const DIGIT_PATTERN = /\d/;
const LEADING_NUMBER_PATTERN = /^[\d.,\s]+/;
const CM_PER_M = 100;

/** Indexed by score. */
const PASSWORD_STRENGTHS: readonly (Omit<PasswordStrength, 'label'> & { labelKey: string })[] = [
  { score: 0, percent: 30, labelKey: 'core.passwordStrength.weak', tone: 'negative' },
  { score: 1, percent: 30, labelKey: 'core.passwordStrength.weak', tone: 'negative' },
  { score: 2, percent: 55, labelKey: 'core.passwordStrength.ok', tone: 'accent' },
  { score: 3, percent: 80, labelKey: 'core.passwordStrength.good', tone: 'warning' },
  { score: 4, percent: 100, labelKey: 'core.passwordStrength.strong', tone: 'positive' },
];
const EMPTY_PASSWORD_STRENGTH: PasswordStrength = {
  score: 0,
  percent: 0,
  label: '',
  tone: 'muted',
};

/**
 * Pure calculations from the design's `renderVals()`: age, BMI, activity level, training,
 * goal weight, password strength and portion scaling. No state. The calorie and macro targets
 * come from the API (`UserProfileService.targets`), never from the app.
 */
@Injectable({ providedIn: 'root' })
export class NutritionCalculator {
  private readonly t = injectTranslate();

  /** Completed years as of `today`. 0 if the date is missing or invalid. */
  ageFromBirthday(isoDate: string | null, today: Date): number {
    const birthday = parseIsoDate(isoDate);
    if (!birthday) {
      return 0;
    }
    let age = today.getFullYear() - birthday.getFullYear();
    const beforeBirthdayThisYear =
      today.getMonth() < birthday.getMonth() ||
      (today.getMonth() === birthday.getMonth() && today.getDate() < birthday.getDate());
    if (beforeBirthdayThisYear) {
      age -= 1;
    }
    return Math.max(0, age);
  }

  /** BMI with one decimal. */
  bmi(kg: number, cm: number): number {
    return roundTo(rawBmi(kg, cm), 1);
  }

  activityLevelFor(steps: number): ActivityLevel {
    const clamped = clamp(steps, STEPS_MIN, STEPS_MAX);
    const level = ACTIVITY_LEVELS.find((candidate) => clamped < candidate.maxSteps);
    return level ?? ACTIVITY_LEVELS[ACTIVITY_LEVELS.length - 1]!;
  }

  trainingFrequency(profile: UserProfile): number {
    return profile.trainingDays.filter(Boolean).length;
  }

  intensityFor(rpe: number | null): IntensityDefinition | null {
    if (rpe == null) {
      return null;
    }
    const clamped = clamp(rpe, RPE_MIN, RPE_MAX);
    return INTENSITIES.find((c) => clamped <= c.maxRpe) ?? INTENSITIES[INTENSITIES.length - 1]!;
  }

  paceFor(paceId: PaceDefinition['id'] | null): PaceDefinition | null {
    return PACES.find((pace) => pace.id === paceId) ?? null;
  }

  stepsToKm(steps: number): number {
    return steps * KM_PER_STEP;
  }

  stepsToKcal(steps: number, kg: number): number {
    return Math.round(steps * kg * KCAL_PER_STEP_PER_KG);
  }

  /** The goal weight scale: just above the current weight (tage) or below it (tabe/hold). */
  goalWeightBounds(goal: GoalId | null, weightKg: number): GoalWeightBounds {
    const current = Math.round(weightKg);
    if (goal === 'tage') {
      return { min: current + 1, max: GOAL_WEIGHT_MAX_KG };
    }
    return { min: GOAL_WEIGHT_MIN_KG, max: Math.max(GOAL_WEIGHT_MIN_SPAN_KG, current - 1) };
  }

  /** Tabe: BMI ≥ 17. Tage: BMI ≤ 35. Hold: always realistic. */
  isGoalWeightRealistic(goal: GoalId | null, goalKg: number, cm: number): boolean {
    const bmi = rawBmi(goalKg, cm);
    switch (goal) {
      case 'tabe':
        return bmi >= GOAL_BMI_MIN;
      case 'tage':
        return bmi <= GOAL_BMI_MAX;
      default:
        return true;
    }
  }

  /** The design's `fpScore`: length ≥ 8, length ≥ 12, an uppercase letter and a digit each give one point. */
  passwordStrength(password: string): PasswordStrength {
    if (password.length === 0) {
      return EMPTY_PASSWORD_STRENGTH;
    }
    const score =
      Number(password.length >= PASSWORD_MIN_LENGTH) +
      Number(password.length >= PASSWORD_STRONG_LENGTH) +
      Number(UPPERCASE_PATTERN.test(password)) +
      Number(DIGIT_PATTERN.test(password));
    const strength = PASSWORD_STRENGTHS[score];
    if (!strength) {
      return EMPTY_PASSWORD_STRENGTH;
    }
    const { labelKey, ...rest } = strength;
    return { ...rest, label: this.t(labelKey) };
  }

  isValidEmail(value: string): boolean {
    return EMAIL_PATTERN.test(value);
  }

  scaleMacros(item: Macros, ratio: number): Macros {
    return {
      kcal: Math.round(item.kcal * ratio),
      protein: Math.round(item.protein * ratio),
      carbs: Math.round(item.carbs * ratio),
      fat: Math.round(item.fat * ratio),
    };
  }

  /** `'250 g'` → 250 g · `'1 portion'` → 1 portion · `'0,5 l'` → 0.5 l. No number → 1, no unit → g. */
  parseQuantity(quantity: string): ParsedQuantity {
    const trimmed = quantity.trim();
    const amount = parseFloat(trimmed.replace(',', '.')) || 1;
    const unit = trimmed.replace(LEADING_NUMBER_PATTERN, '').trim() || DEFAULT_QUANTITY_UNIT;
    return { amount, unit };
  }
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const match = ISO_DATE_PATTERN.exec(value);
  const parsed = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rawBmi(kg: number, cm: number): number {
  if (cm <= 0) {
    return 0;
  }
  const metres = cm / CM_PER_M;
  return kg / (metres * metres);
}
