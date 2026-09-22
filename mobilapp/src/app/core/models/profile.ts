import { Tone } from './tone';

export type Gender = 'mand' | 'kvinde' | 'andet';
export type GoalId = 'tabe' | 'hold' | 'tage';
export type PaceId = 'rolig' | 'moderat' | 'hurtig';
export type IntensityId = 'mildt' | 'moderat' | 'haardt';
export type UnitSystem = 'metrisk' | 'imperial';

/** Beskæring af profilbilledet. `zoom` 1..3, `x`/`y` 0..100 (procent). */
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
  /** ISO-dato (`YYYY-MM-DD`) eller `null`, hvis ikke valgt. */
  birthday: string | null;
  gender: Gender | null;
  weightKg: number;
  heightCm: number;
  stepsPerDay: number;
  /** Syv flag, mandag først. */
  trainingDays: readonly boolean[];
  trainingMinutes: number;
  /** Oplevet anstrengelse 1..10 eller `null`, hvis ikke valgt. */
  trainingRpe: number | null;
  goal: GoalId | null;
  pace: PaceId | null;
  goalWeightKg: number;
  notificationsEnabled: boolean;
  units: UnitSystem;
  /** Manuelt kaloriemål, der overstyrer det beregnede. */
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
  /** Øvre grænse (eksklusiv) for skridt pr. dag på dette niveau. */
  maxSteps: number;
  /** Physical Activity Level – faktor på basalstofskiftet. */
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
