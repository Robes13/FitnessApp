import { Tone } from './tone';

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
