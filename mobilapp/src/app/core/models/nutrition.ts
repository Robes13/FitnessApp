import { DailyFoodTotals } from './food';
import { Tone } from './tone';
import { WeighEntry } from './weight';

export interface GoalWeightBounds {
  min: number;
  max: number;
}

export interface ParsedQuantity {
  amount: number;
  unit: string;
}

export interface PasswordStrength {
  /** 0..4 – one point per requirement met. */
  score: number;
  /** 0..100 for the strength meter. */
  percent: number;
  label: string;
  tone: Tone;
}

/** What the adaptive target is estimated from. The caller limits both lists to the window. */
export interface AdaptiveGoalInput {
  /** Expenditure by formula (BMR × PAL + training), before the goal's surplus/deficit. */
  formulaTdeeKcal: number;
  /** One row per day in the window; days with `entryCount` 0 are ignored. */
  dailyTotals: readonly DailyFoodTotals[];
  /** Weigh-ins in the window, in any order. */
  weighIns: readonly WeighEntry[];
}

/** The estimated actual expenditure and how far the target is moved towards it. */
export interface AdaptiveAdjustment {
  estimatedTdeeKcal: number;
  /** Signed, rounded to 10 kcal and limited to ± `ADAPTIVE_MAX_ADJUSTMENT_KCAL`. */
  adjustmentKcal: number;
}
