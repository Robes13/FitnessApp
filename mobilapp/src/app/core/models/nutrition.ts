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
  /** 0..4 – ét point pr. opfyldt krav. */
  score: number;
  /** 0..100 til styrkemåleren. */
  percent: number;
  label: string;
  tone: Tone;
}
