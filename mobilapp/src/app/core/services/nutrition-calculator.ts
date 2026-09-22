import { Injectable } from '@angular/core';
import {
  ACTIVITY_LEVELS,
  BMR_AGE_FACTOR,
  BMR_FALLBACK_AGE,
  BMR_GENDER_OFFSET,
  BMR_HEIGHT_FACTOR,
  BMR_WEIGHT_FACTOR,
  DEFAULT_QUANTITY_UNIT,
  GOAL_BMI_MAX,
  GOAL_BMI_MIN,
  GOAL_WEIGHT_MAX_KG,
  GOAL_WEIGHT_MIN_KG,
  GOAL_WEIGHT_MIN_SPAN_KG,
  INTENSITIES,
  KCAL_MIN,
  KCAL_PER_GRAM,
  KCAL_PER_STEP_PER_KG,
  KCAL_ROUNDING,
  KM_PER_STEP,
  MACRO_SPLIT,
  PACES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRONG_LENGTH,
  RPE_MAX,
  RPE_MIN,
  STEPS_MAX,
  STEPS_MIN,
  TRAINING_MAX_MINUTES,
  TRAINING_MIN_MINUTES,
} from '../constants/nutrition';
import { Macros } from '../models/food';
import { GoalWeightBounds, ParsedQuantity, PasswordStrength } from '../models/nutrition';
import {
  ActivityLevel,
  Gender,
  GoalId,
  IntensityDefinition,
  PaceDefinition,
  UserProfile,
} from '../models/profile';
import { clamp, roundTo } from '../utils/math';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const UPPERCASE_PATTERN = /[A-ZÆØÅ]/;
const DIGIT_PATTERN = /\d/;
const LEADING_NUMBER_PATTERN = /^[\d.,\s]+/;
const CM_PER_M = 100;

const PASSWORD_STRENGTHS: readonly PasswordStrength[] = [
  { score: 0, percent: 30, label: 'Svag', tone: 'negative' },
  { score: 1, percent: 30, label: 'Svag', tone: 'negative' },
  { score: 2, percent: 55, label: 'OK', tone: 'accent' },
  { score: 3, percent: 80, label: 'God', tone: 'warning' },
  { score: 4, percent: 100, label: 'Stærk', tone: 'positive' },
];
const EMPTY_PASSWORD_STRENGTH: PasswordStrength = {
  score: 0,
  percent: 0,
  label: '',
  tone: 'muted',
};

/**
 * Rene beregninger fra designets `renderVals()`: alder, BMR (Mifflin-St Jeor), kaloriemål,
 * makrofordeling, målvægt, adgangskodestyrke og portionsskalering. Ingen state.
 */
@Injectable({ providedIn: 'root' })
export class NutritionCalculator {
  /** Fyldte år på `today`. 0 hvis datoen mangler eller er ugyldig. */
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

  /** BMI med én decimal. */
  bmi(kg: number, cm: number): number {
    return roundTo(rawBmi(kg, cm), 1);
  }

  /** Basalstofskifte (Mifflin-St Jeor). Alder 0 → 30 år; `andet`/ukendt køn → gennemsnit. */
  bmr(kg: number, cm: number, age: number, gender: Gender | null): number {
    const effectiveAge = age > 0 ? age : BMR_FALLBACK_AGE;
    const offset = BMR_GENDER_OFFSET[gender ?? 'andet'];
    return BMR_WEIGHT_FACTOR * kg + BMR_HEIGHT_FACTOR * cm - BMR_AGE_FACTOR * effectiveAge + offset;
  }

  activityLevelFor(steps: number): ActivityLevel {
    const clamped = clamp(steps, STEPS_MIN, STEPS_MAX);
    const level = ACTIVITY_LEVELS.find((candidate) => clamped < candidate.maxSteps);
    return level ?? ACTIVITY_LEVELS[ACTIVITY_LEVELS.length - 1]!;
  }

  /** Dagligt behov uden mål-justering, rundet til nærmeste 10 kcal. */
  baseKcal(bmr: number, pal: number): number {
    return Math.round((bmr * pal) / KCAL_ROUNDING) * KCAL_ROUNDING;
  }

  goalAdjustment(goal: GoalId | null, pace: PaceDefinition | null): number {
    if (!pace || !goal) {
      return 0;
    }
    switch (goal) {
      case 'tabe':
        return -pace.kcalPerDay;
      case 'tage':
        return pace.kcalPerDay;
      case 'hold':
        return 0;
    }
  }

  /** Beregnet forslag (uden manuel overstyring), aldrig under 1200 kcal. */
  suggestedKcalTarget(profile: UserProfile, today: Date): number {
    const age = this.ageFromBirthday(profile.birthday, today);
    const bmr = this.bmr(profile.weightKg, profile.heightCm, age, profile.gender);
    const base = this.baseKcal(bmr, this.activityLevelFor(profile.stepsPerDay).pal);
    const adjustment = this.goalAdjustment(profile.goal, this.paceFor(profile.pace));
    return Math.max(KCAL_MIN, base + adjustment);
  }

  /** Dagligt kaloriemål: manuel overstyring, ellers det beregnede forslag. */
  kcalTarget(profile: UserProfile, today: Date): number {
    return profile.kcalOverride ?? this.suggestedKcalTarget(profile, today);
  }

  /** Gram pr. makro ud fra 30/45/25-fordelingen. `kcal` er selve målet. */
  macroGoals(kcalTarget: number): Macros {
    return {
      kcal: kcalTarget,
      protein: Math.round((kcalTarget * MACRO_SPLIT.protein) / KCAL_PER_GRAM.protein),
      carbs: Math.round((kcalTarget * MACRO_SPLIT.carbs) / KCAL_PER_GRAM.carbs),
      fat: Math.round((kcalTarget * MACRO_SPLIT.fat) / KCAL_PER_GRAM.fat),
    };
  }

  trainingFrequency(profile: UserProfile): number {
    return profile.trainingDays.filter(Boolean).length;
  }

  weeklyTrainingMinutes(profile: UserProfile): number {
    const minutes = clamp(profile.trainingMinutes, TRAINING_MIN_MINUTES, TRAINING_MAX_MINUTES);
    return this.trainingFrequency(profile) * minutes;
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

  /** Skalaen for målvægt: lige over nuværende vægt (tage) eller under den (tabe/hold). */
  goalWeightBounds(goal: GoalId | null, weightKg: number): GoalWeightBounds {
    const current = Math.round(weightKg);
    if (goal === 'tage') {
      return { min: current + 1, max: GOAL_WEIGHT_MAX_KG };
    }
    return { min: GOAL_WEIGHT_MIN_KG, max: Math.max(GOAL_WEIGHT_MIN_SPAN_KG, current - 1) };
  }

  /** Tabe: BMI ≥ 17. Tage: BMI ≤ 35. Hold: altid realistisk. */
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

  /** Designets `fpScore`: længde ≥ 8, længde ≥ 12, et stort bogstav og et tal giver ét point hver. */
  passwordStrength(password: string): PasswordStrength {
    if (password.length === 0) {
      return EMPTY_PASSWORD_STRENGTH;
    }
    const score =
      Number(password.length >= PASSWORD_MIN_LENGTH) +
      Number(password.length >= PASSWORD_STRONG_LENGTH) +
      Number(UPPERCASE_PATTERN.test(password)) +
      Number(DIGIT_PATTERN.test(password));
    return PASSWORD_STRENGTHS[score] ?? EMPTY_PASSWORD_STRENGTH;
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

  /** `'250 g'` → 250 g · `'1 portion'` → 1 portion · `'0,5 l'` → 0.5 l. Uden tal → 1, uden enhed → g. */
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
