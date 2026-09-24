import { Injectable } from '@angular/core';
import {
  ACTIVITY_LEVELS,
  ADAPTIVE_MAX_ADJUSTMENT_KCAL,
  ADAPTIVE_MIN_DAY_FRACTION,
  ADAPTIVE_MIN_LOGGED_DAYS,
  ADAPTIVE_MIN_WEIGH_INS,
  ADAPTIVE_MIN_WEIGHT_SPAN_DAYS,
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
  KCAL_PER_KG_BODY_WEIGHT,
  KCAL_PER_STEP_PER_KG,
  KCAL_ROUNDING,
  KM_PER_STEP,
  MACRO_SPLIT,
  PACES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRONG_LENGTH,
  RESTING_MET,
  RPE_MAX,
  RPE_MIN,
  STEPS_MAX,
  STEPS_MIN,
  TRAINING_FALLBACK_INTENSITY,
  TRAINING_MAX_MINUTES,
  TRAINING_MET,
  TRAINING_MIN_MINUTES,
} from '../../constants/nutrition';
import { DAYS_PER_WEEK, MINUTES_PER_HOUR } from '../../constants/time';
import { Macros } from '../../models/food';
import {
  AdaptiveAdjustment,
  AdaptiveGoalInput,
  GoalWeightBounds,
  ParsedQuantity,
  PasswordStrength,
} from '../../models/nutrition';
import {
  ActivityLevel,
  Gender,
  GoalId,
  IntensityDefinition,
  PaceDefinition,
  UserProfile,
} from '../../models/profile';
import { WeighEntry } from '../../models/weight';
import { daysBetween } from '../../utils/date-format';
import { clamp, roundTo } from '../../utils/math';

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
 * Pure calculations from the design's `renderVals()`: age, BMR (Mifflin-St Jeor), training
 * expenditure, calorie target (incl. the adaptive adjustment), macro split, goal weight,
 * password strength and portion scaling. No state.
 */
@Injectable({ providedIn: 'root' })
export class NutritionCalculator {
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

  /** Basal metabolic rate (Mifflin-St Jeor). Age 0 → 30 years; `andet`/unknown gender → average. */
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

  /** Daily need without goal adjustment, rounded to the nearest 10 kcal. */
  baseKcal(bmr: number, pal: number): number {
    return roundToKcalStep(bmr * pal);
  }

  /**
   * Training expenditure averaged over the week:
   * days/week × minutes × (MET − resting MET) × kg / 60 / 7. 0 without training days.
   * Without a chosen RPE the moderate MET is used.
   */
  exerciseKcalPerDay(profile: UserProfile): number {
    const intensityId = this.intensityFor(profile.trainingRpe)?.id ?? TRAINING_FALLBACK_INTENSITY;
    const netMet = TRAINING_MET[intensityId] - RESTING_MET;
    const weeklyKcal =
      (this.weeklyTrainingMinutes(profile) * netMet * profile.weightKg) / MINUTES_PER_HOUR;
    return weeklyKcal / DAYS_PER_WEEK;
  }

  /** Expenditure by formula: BMR × PAL (steps) + training, rounded to the nearest 10 kcal. */
  maintenanceKcal(profile: UserProfile, today: Date): number {
    const age = this.ageFromBirthday(profile.birthday, today);
    const bmr = this.bmr(profile.weightKg, profile.heightCm, age, profile.gender);
    const pal = this.activityLevelFor(profile.stepsPerDay).pal;
    return roundToKcalStep(bmr * pal + this.exerciseKcalPerDay(profile));
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

  /**
   * Calculated suggestion (without manual override): maintenance + goal adjustment +
   * `adaptiveKcal` (see `adaptiveAdjustment`), never below 1200 kcal.
   */
  suggestedKcalTarget(profile: UserProfile, today: Date, adaptiveKcal = 0): number {
    const adjustment = this.goalAdjustment(profile.goal, this.paceFor(profile.pace));
    return Math.max(KCAL_MIN, this.maintenanceKcal(profile, today) + adjustment + adaptiveKcal);
  }

  /** Daily calorie target: manual override, otherwise the calculated suggestion. */
  kcalTarget(profile: UserProfile, today: Date, adaptiveKcal = 0): number {
    return profile.kcalOverride ?? this.suggestedKcalTarget(profile, today, adaptiveKcal);
  }

  /**
   * Estimates the actual expenditure from the window's data and how far the target should move
   * towards it: estimated TDEE = average kcal on logged days − weight trend (kg/day) × 7700.
   * The weight trend is the least-squares slope through the weigh-ins. A day counts as logged
   * only when its kcal reach `ADAPTIVE_MIN_DAY_FRACTION` of the formula expenditure; partly
   * logged days are left out. `null` when there is too little data (fewer than 10 logged days,
   * or fewer than 2 weigh-ins spanning 14 days).
   */
  adaptiveAdjustment(input: AdaptiveGoalInput): AdaptiveAdjustment | null {
    const minDayKcal = input.formulaTdeeKcal * ADAPTIVE_MIN_DAY_FRACTION;
    const loggedDays = input.dailyTotals.filter(
      (day) => day.entryCount > 0 && day.totals.kcal >= minDayKcal,
    );
    if (loggedDays.length < ADAPTIVE_MIN_LOGGED_DAYS) {
      return null;
    }
    const slopeKgPerDay = weightTrendKgPerDay(input.weighIns);
    if (slopeKgPerDay === null) {
      return null;
    }
    const averageKcal =
      loggedDays.reduce((sum, day) => sum + day.totals.kcal, 0) / loggedDays.length;
    const estimatedTdeeKcal = roundToKcalStep(
      averageKcal - slopeKgPerDay * KCAL_PER_KG_BODY_WEIGHT,
    );
    const adjustmentKcal = clamp(
      roundToKcalStep(estimatedTdeeKcal - input.formulaTdeeKcal),
      -ADAPTIVE_MAX_ADJUSTMENT_KCAL,
      ADAPTIVE_MAX_ADJUSTMENT_KCAL,
    );
    return { estimatedTdeeKcal, adjustmentKcal };
  }

  /** Grams per macro based on the 30/45/25 split. `kcal` is the target itself. */
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

/** Rounds to the nearest `KCAL_ROUNDING` kcal. `+ 0` normalizes `-0` to `0`. */
function roundToKcalStep(kcal: number): number {
  return Math.round(kcal / KCAL_ROUNDING) * KCAL_ROUNDING + 0;
}

/**
 * Least-squares slope (kg per day) through the weigh-ins. `null` with fewer than
 * `ADAPTIVE_MIN_WEIGH_INS` weigh-ins or when they span less than `ADAPTIVE_MIN_WEIGHT_SPAN_DAYS`.
 */
function weightTrendKgPerDay(weighIns: readonly WeighEntry[]): number | null {
  if (weighIns.length < ADAPTIVE_MIN_WEIGH_INS) {
    return null;
  }
  const sorted = [...weighIns].sort((a, b) => a.at.localeCompare(b.at));
  const first = new Date(sorted[0]!.at);
  const points = sorted.map((entry) => ({
    day: daysBetween(first, new Date(entry.at)),
    kg: entry.kg,
  }));
  if (points[points.length - 1]!.day < ADAPTIVE_MIN_WEIGHT_SPAN_DAYS) {
    return null;
  }
  const meanDay = points.reduce((sum, point) => sum + point.day, 0) / points.length;
  const meanKg = points.reduce((sum, point) => sum + point.kg, 0) / points.length;
  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    covariance += (point.day - meanDay) * (point.kg - meanKg);
    variance += (point.day - meanDay) ** 2;
  }
  return covariance / variance;
}

function rawBmi(kg: number, cm: number): number {
  if (cm <= 0) {
    return 0;
  }
  const metres = cm / CM_PER_M;
  return kg / (metres * metres);
}
