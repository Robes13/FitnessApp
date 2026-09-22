import { UserProfile } from '../models/profile';
import { STEPS_DEFAULT, TRAINING_DEFAULT_MINUTES } from './nutrition';

/**
 * The starting position for the sliders in the sign-up flow. This isn't user data and not
 * a guess about the user either – just a place the slider can start until the user adjusts it.
 */
export const WEIGHT_START_KG = 75;
export const HEIGHT_START_CM = 178;
export const GOAL_WEIGHT_START_KG = 70;

/** Training days, Monday first. No days selected until the user picks them. */
const NO_TRAINING_DAYS: readonly boolean[] = [false, false, false, false, false, false, false];

/**
 * The profile before the user has filled anything in. Fields that can't be guessed are
 * `null` or empty; the rest are the neutral starting values above. Used both as the
 * starting point in the sign-up flow and to fill in fields missing from a saved profile.
 */
export const DEFAULT_PROFILE: UserProfile = {
  username: '',
  email: '',
  birthday: null,
  gender: null,
  weightKg: WEIGHT_START_KG,
  heightCm: HEIGHT_START_CM,
  stepsPerDay: STEPS_DEFAULT,
  trainingDays: NO_TRAINING_DAYS,
  trainingMinutes: TRAINING_DEFAULT_MINUTES,
  trainingRpe: null,
  goal: null,
  pace: null,
  goalWeightKg: GOAL_WEIGHT_START_KG,
  notificationsEnabled: true,
  units: 'metrisk',
  kcalOverride: null,
  photo: null,
};
