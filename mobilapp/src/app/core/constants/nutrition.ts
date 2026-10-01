import {
  ActivityLevel,
  Gender,
  GenderDefinition,
  GoalDefinition,
  IntensityDefinition,
  IntensityId,
  PaceDefinition,
} from '../models/profile';
import { DAYS_PER_WEEK } from './time';

/** Energy in one kg of body weight change (the common 7700 kcal/kg rule of thumb, as in the API). */
export const KCAL_PER_KG_BODY_WEIGHT = 7700;

export const GOALS: readonly GoalDefinition[] = [
  {
    id: 'tabe',
    labelKey: 'core.nutrition.goals.lose.label',
    descriptionKey: 'core.nutrition.goals.lose.description',
  },
  {
    id: 'hold',
    labelKey: 'core.nutrition.goals.maintain.label',
    descriptionKey: 'core.nutrition.goals.maintain.description',
  },
  {
    id: 'tage',
    labelKey: 'core.nutrition.goals.gain.label',
    descriptionKey: 'core.nutrition.goals.gain.description',
  },
];

/** The API's daily deficit/surplus for a pace (`GoalCalculator`), so the pace text matches the target. */
function paceKcalPerDay(kgPerWeek: number): number {
  return Math.round((kgPerWeek * KCAL_PER_KG_BODY_WEIGHT) / DAYS_PER_WEEK);
}

export const PACES: readonly PaceDefinition[] = [
  {
    id: 'rolig',
    labelKey: 'core.nutrition.paces.calm.label',
    descriptionKey: 'core.nutrition.paces.calm.description',
    rateLabelKey: 'core.nutrition.paces.calm.rate',
    kcalPerDay: paceKcalPerDay(0.25),
    kgPerWeek: 0.25,
  },
  {
    id: 'moderat',
    labelKey: 'core.nutrition.paces.moderate.label',
    descriptionKey: 'core.nutrition.paces.moderate.description',
    rateLabelKey: 'core.nutrition.paces.moderate.rate',
    kcalPerDay: paceKcalPerDay(0.5),
    kgPerWeek: 0.5,
  },
  {
    id: 'hurtig',
    labelKey: 'core.nutrition.paces.fast.label',
    descriptionKey: 'core.nutrition.paces.fast.description',
    rateLabelKey: 'core.nutrition.paces.fast.rate',
    kcalPerDay: paceKcalPerDay(1),
    kgPerWeek: 1,
  },
];

/** The design's `actLevels`. The level chosen is the first one where steps < `maxSteps`. */
export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  { maxSteps: 2500, labelKey: 'core.nutrition.activityLevels.sedentary' },
  { maxSteps: 5500, labelKey: 'core.nutrition.activityLevels.lightlyActive' },
  { maxSteps: 9000, labelKey: 'core.nutrition.activityLevels.active' },
  { maxSteps: 13000, labelKey: 'core.nutrition.activityLevels.veryActive' },
  { maxSteps: 18000, labelKey: 'core.nutrition.activityLevels.extremelyActive' },
  { maxSteps: 99999, labelKey: 'core.nutrition.activityLevels.marathonReady' },
];

/** The design's `intDef`. An RPE number maps to the first level where rpe <= `maxRpe`. */
export const INTENSITIES: readonly IntensityDefinition[] = [
  {
    id: 'mildt',
    labelKey: 'core.nutrition.intensities.mild.label',
    descriptionKey: 'core.nutrition.intensities.mild.description',
    talkTestKey: 'core.nutrition.intensities.mild.talkTest',
    scaleLabel: '3/10',
    zoneKey: 'core.nutrition.intensities.mild.zone',
    level: 1,
    rpe: 3,
    maxRpe: 4,
    adjectiveKey: 'core.nutrition.intensities.mild.adjective',
    tone: 'positive',
  },
  {
    id: 'moderat',
    labelKey: 'core.nutrition.intensities.moderate.label',
    descriptionKey: 'core.nutrition.intensities.moderate.description',
    talkTestKey: 'core.nutrition.intensities.moderate.talkTest',
    scaleLabel: '6/10',
    zoneKey: 'core.nutrition.intensities.moderate.zone',
    level: 2,
    rpe: 6,
    maxRpe: 7,
    adjectiveKey: 'core.nutrition.intensities.moderate.adjective',
    tone: 'accent',
  },
  {
    id: 'haardt',
    labelKey: 'core.nutrition.intensities.hard.label',
    descriptionKey: 'core.nutrition.intensities.hard.description',
    talkTestKey: 'core.nutrition.intensities.hard.talkTest',
    scaleLabel: '9/10',
    zoneKey: 'core.nutrition.intensities.hard.zone',
    level: 3,
    rpe: 9,
    maxRpe: 10,
    adjectiveKey: 'core.nutrition.intensities.hard.adjective',
    tone: 'negative',
  },
];

export const GENDERS: readonly GenderDefinition[] = [
  {
    id: 'mand',
    labelKey: 'core.nutrition.genders.male.label',
    descriptionKey: 'core.nutrition.genders.male.description',
  },
  {
    id: 'kvinde',
    labelKey: 'core.nutrition.genders.female.label',
    descriptionKey: 'core.nutrition.genders.female.description',
  },
  {
    id: 'andet',
    labelKey: 'core.nutrition.genders.other.label',
    descriptionKey: 'core.nutrition.genders.other.description',
  },
];

export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;
/** The API accepts 100–250 cm. */
export const HEIGHT_MIN_CM = 100;
export const HEIGHT_MAX_CM = 250;
export const STEPS_MIN = 0;
export const STEPS_MAX = 50000;
export const STEPS_DEFAULT = 6000;
export const TRAINING_MIN_MINUTES = 10;
export const TRAINING_MAX_MINUTES = 180;
export const TRAINING_DEFAULT_MINUTES = 45;
export const RPE_MIN = 1;
export const RPE_MAX = 10;
/** The API's age rule (`ProfileValidation`: 13–100 years, plan-v2 P8). */
export const MIN_AGE = 13;
export const MAX_AGE = 100;
/** The API's password rule (register, reset, change): 10–200 characters, no complexity rules. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

/**
 * The API's safe minimum for the daily calorie target: it lifts the target to exactly this
 * (`API/Services/Goals/GoalCalculator.cs`: 1500 kcal for men, 1200 kcal otherwise).
 */
export const CALORIE_FLOOR_KCAL: Readonly<Record<Gender, number>> = {
  mand: 1500,
  kvinde: 1200,
  andet: 1200,
};

/** Goal weight scale (the design's `gMin`/`gMax`). */
export const GOAL_WEIGHT_MIN_KG = 35;
export const GOAL_WEIGHT_MIN_SPAN_KG = 36;
export const GOAL_WEIGHT_MAX_KG = 200;
/** BMI bounds for a realistic goal ("too low" / "very high for your height"). */
export const GOAL_BMI_MIN = 17;
export const GOAL_BMI_MAX = 35;

/** Step conversion (the design's `stepKm` / `stepKcal`). */
export const KM_PER_STEP = 0.00075;
export const KCAL_PER_STEP_PER_KG = 0.00045;

/** Intensity sent to the API when the user trains but hasn't chosen an RPE. */
export const TRAINING_FALLBACK_INTENSITY: IntensityId = 'moderat';

/** Max number of results in food search. */
export const FOOD_SEARCH_MAX_RESULTS = 6;

/** Default unit when a quantity string doesn't include one. */
export const DEFAULT_QUANTITY_UNIT = 'g';
