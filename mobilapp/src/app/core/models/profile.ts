import { Tone } from './tone';

export type Gender = 'mand' | 'kvinde' | 'andet';
export type GoalId = 'tabe' | 'hold' | 'tage';
export type PaceId = 'rolig' | 'moderat' | 'hurtig';
export type IntensityId = 'mildt' | 'moderat' | 'haardt';

/** Cropping of the profile photo. `zoom` 1..3, `x`/`y` 0..100 (percent). */
export interface ProfilePhoto {
  dataUrl: string;
  aspectRatio: number;
  zoom: number;
  x: number;
  y: number;
}

export interface UserProfile {
  username: string;
  email: string;
  /** ISO date (`YYYY-MM-DD`) or `null`, if not chosen. */
  birthday: string | null;
  gender: Gender | null;
  weightKg: number;
  heightCm: number;
  stepsPerDay: number;
  /** Seven flags, Monday first. */
  trainingDays: readonly boolean[];
  trainingMinutes: number;
  /** Perceived exertion 1..10 or `null`, if not chosen. */
  trainingRpe: number | null;
  goal: GoalId | null;
  pace: PaceId | null;
  goalWeightKg: number;
  notificationsEnabled: boolean;
  photo: ProfilePhoto | null;
}

/** Texts are translation keys (`…Key`). */
export interface GoalDefinition {
  id: GoalId;
  labelKey: string;
  descriptionKey: string;
}

export interface PaceDefinition {
  id: PaceId;
  labelKey: string;
  descriptionKey: string;
  rateLabelKey: string;
  kcalPerDay: number;
  kgPerWeek: number;
}

export interface ActivityLevel {
  /** Upper bound (exclusive) for steps per day at this level. */
  maxSteps: number;
  labelKey: string;
}

export interface IntensityDefinition {
  id: IntensityId;
  labelKey: string;
  descriptionKey: string;
  talkTestKey: string;
  scaleLabel: string;
  zoneKey: string;
  level: 1 | 2 | 3;
  rpe: number;
  maxRpe: number;
  adjectiveKey: string;
  tone: Tone;
}

export interface GenderDefinition {
  id: Gender;
  labelKey: string;
  descriptionKey: string;
}
