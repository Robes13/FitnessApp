import { Tone } from './tone';

export type Gender = 'mand' | 'kvinde' | 'andet';
export type GoalId = 'tabe' | 'hold' | 'tage';
export type PaceId = 'rolig' | 'moderat' | 'hurtig';
export type IntensityId = 'mildt' | 'moderat' | 'haardt';
export type UnitSystem = 'metrisk' | 'imperial';

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
  units: UnitSystem;
  /** Manual calorie target that overrides the calculated one. */
  kcalOverride: number | null;
  photo: ProfilePhoto | null;
}

export interface GoalDefinition {
  id: GoalId;
  label: string;
  description: string;
}

export interface PaceDefinition {
  id: PaceId;
  label: string;
  description: string;
  rateLabel: string;
  kcalPerDay: number;
  kgPerWeek: number;
}

export interface ActivityLevel {
  /** Upper bound (exclusive) for steps per day at this level. */
  maxSteps: number;
  /** Physical Activity Level – factor on the basal metabolic rate. */
  pal: number;
  label: string;
}

export interface IntensityDefinition {
  id: IntensityId;
  label: string;
  description: string;
  talkTest: string;
  scaleLabel: string;
  zone: string;
  level: 1 | 2 | 3;
  rpe: number;
  maxRpe: number;
  adjective: string;
  tone: Tone;
}

export interface GenderDefinition {
  id: Gender;
  label: string;
  description: string;
}

export interface UnitSystemDefinition {
  id: UnitSystem;
  label: string;
  description: string;
}
