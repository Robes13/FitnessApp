import { Tone } from './tone';

export interface GoalWeightBounds {
  min: number;
  max: number;
}

export interface ParsedQuantity {
  amount: number;
  unit: string;
}

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;
export type PasswordStrengthLabel = '' | 'Svag' | 'OK' | 'God' | 'Stærk';

export interface PasswordStrength {
  score: PasswordStrengthScore;
  /** 0..100 til styrkemåleren. */
  percent: number;
  label: PasswordStrengthLabel;
  tone: Tone;
}
