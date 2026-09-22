import {
  ActivityLevel,
  Gender,
  GenderDefinition,
  GoalDefinition,
  IntensityDefinition,
  IntensityId,
  PaceDefinition,
  UnitSystemDefinition,
} from '../models/profile';
import { Macros } from '../models/food';

export const GOALS: readonly GoalDefinition[] = [
  { id: 'tabe', label: 'Tabe mig', description: 'Kalorieunderskud og bevægelse' },
  { id: 'hold', label: 'Holde vægten', description: 'Balance og gode vaner' },
  { id: 'tage', label: 'Tage på', description: 'Overskud og styrke' },
];

export const PACES: readonly PaceDefinition[] = [
  {
    id: 'rolig',
    label: 'Roligt',
    description: 'Let at holde, mindst mærkbart',
    rateLabel: '0,25 kg/uge',
    kcalPerDay: 250,
    kgPerWeek: 0.25,
  },
  {
    id: 'moderat',
    label: 'Moderat',
    description: 'Anbefalet for de fleste',
    rateLabel: '0,5 kg/uge',
    kcalPerDay: 500,
    kgPerWeek: 0.5,
  },
  {
    id: 'hurtig',
    label: 'Hurtigt',
    description: 'Kræver disciplin',
    rateLabel: '1 kg/uge',
    kcalPerDay: 1000,
    kgPerWeek: 1,
  },
];

/** The design's `actLevels`. The level chosen is the first one where steps < `maxSteps`. */
export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  { maxSteps: 2500, pal: 1.25, label: 'Stillesiddende' },
  { maxSteps: 5500, pal: 1.4, label: 'Let aktiv' },
  { maxSteps: 9000, pal: 1.55, label: 'Aktiv' },
  { maxSteps: 13000, pal: 1.7, label: 'Meget aktiv' },
  { maxSteps: 18000, pal: 1.85, label: 'Ekstremt aktiv' },
  { maxSteps: 99999, pal: 1.95, label: 'Maratonklar' },
];

/** The design's `intDef`. An RPE number maps to the first level where rpe <= `maxRpe`. */
export const INTENSITIES: readonly IntensityDefinition[] = [
  {
    id: 'mildt',
    label: 'Mildt',
    description: 'Du kan snakke hele vejen igennem – rolig gang, let cykling, mobility.',
    talkTest: 'Du kan snakke hele vejen igennem.',
    scaleLabel: '3/10',
    zone: 'let anstrengelse',
    level: 1,
    rpe: 3,
    maxRpe: 4,
    adjective: 'mild',
    tone: 'positive',
  },
  {
    id: 'moderat',
    label: 'Moderat',
    description: 'Du kan snakke i korte sætninger – rask gang, jog, styrke med pauser.',
    talkTest: 'Du kan snakke i korte sætninger.',
    scaleLabel: '6/10',
    zone: 'moderat anstrengelse',
    level: 2,
    rpe: 6,
    maxRpe: 7,
    adjective: 'moderat',
    tone: 'accent',
  },
  {
    id: 'haardt',
    label: 'Hårdt',
    description: 'Du har svært ved at få ord frem – intervaller, bakker, tunge løft.',
    talkTest: 'Du har svært ved at få ord frem.',
    scaleLabel: '9/10',
    zone: 'hård anstrengelse',
    level: 3,
    rpe: 9,
    maxRpe: 10,
    adjective: 'hård',
    tone: 'negative',
  },
];

export const GENDERS: readonly GenderDefinition[] = [
  { id: 'mand', label: 'Mand', description: 'Beregnes med mandlig stofskifte-formel' },
  { id: 'kvinde', label: 'Kvinde', description: 'Beregnes med kvindelig stofskifte-formel' },
  { id: 'andet', label: 'Andet', description: 'Gennemsnit af de to formler' },
];

export const UNIT_SYSTEMS: readonly UnitSystemDefinition[] = [
  { id: 'metrisk', label: 'Metrisk', description: 'kg · cm' },
  { id: 'imperial', label: 'Imperial', description: 'lb · in' },
];

export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;
export const HEIGHT_MIN_CM = 55;
export const HEIGHT_MAX_CM = 250;
export const STEPS_MIN = 0;
export const STEPS_MAX = 50000;
export const STEPS_DEFAULT = 6000;
export const TRAINING_MIN_MINUTES = 10;
export const TRAINING_MAX_MINUTES = 180;
export const TRAINING_DEFAULT_MINUTES = 45;
export const RPE_MIN = 1;
export const RPE_MAX = 10;
export const KCAL_MIN = 1200;
export const KCAL_MAX = 5000;
export const MIN_AGE = 16;
export const MAX_AGE = 120;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_STRONG_LENGTH = 12;
export const RESET_CODE_LENGTH = 4;

/** Share of daily calories per macro (the design's 30/45/25). */
export const MACRO_SPLIT: Readonly<Omit<Macros, 'kcal'>> = { protein: 0.3, carbs: 0.45, fat: 0.25 };
export const KCAL_PER_GRAM: Readonly<Omit<Macros, 'kcal'>> = { protein: 4, carbs: 4, fat: 9 };

/** Mifflin-St Jeor: gender constant. `andet`/unknown uses the average of the two. */
export const BMR_GENDER_OFFSET: Readonly<Record<Gender, number>> = {
  mand: 5,
  kvinde: -161,
  andet: -78,
};
export const BMR_WEIGHT_FACTOR = 10;
export const BMR_HEIGHT_FACTOR = 6.25;
export const BMR_AGE_FACTOR = 5;
/** Used in BMR when the birthday isn't specified. */
export const BMR_FALLBACK_AGE = 30;
/** Calorie needs are rounded to the nearest 10. */
export const KCAL_ROUNDING = 10;

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

/**
 * Metabolic equivalents per training intensity (Compendium of Physical Activities, Ainsworth
 * et al. 2011/Herrmann et al. 2024): light ≈ 3.5 (brisk walk, easy cycling), moderate ≈ 5
 * (jog, strength with rests), vigorous ≈ 8 (intervals, heavy lifting). 1 MET ≈ 1 kcal/kg/h.
 */
export const TRAINING_MET: Readonly<Record<IntensityId, number>> = {
  mildt: 3.5,
  moderat: 5,
  haardt: 8,
};
/** Resting MET. It is subtracted, because BMR × PAL already covers resting during the session. */
export const RESTING_MET = 1;
/** Intensity used when the user trains but hasn't chosen an RPE. */
export const TRAINING_FALLBACK_INTENSITY: IntensityId = 'moderat';

/**
 * Adaptive target: over the last `ADAPTIVE_WINDOW_DAYS` completed days the actual expenditure
 * is estimated from logged intake and the weight trend, and the target is nudged towards it.
 */
export const ADAPTIVE_WINDOW_DAYS = 21;
/** Minimum number of fully logged days (see `ADAPTIVE_MIN_DAY_FRACTION`). */
export const ADAPTIVE_MIN_LOGGED_DAYS = 10;
/**
 * A day only counts as logged when its kcal reach this share of the formula expenditure.
 * Below that the day was most likely logged only partly (a forgotten dinner), and counting it
 * would make the estimate think the user eats less than they do.
 */
export const ADAPTIVE_MIN_DAY_FRACTION = 0.5;
/** Minimum number of weigh-ins and the minimum number of days between the first and last. */
export const ADAPTIVE_MIN_WEIGH_INS = 2;
export const ADAPTIVE_MIN_WEIGHT_SPAN_DAYS = 14;
/** The adjustment never moves the target more than this many kcal either way. */
export const ADAPTIVE_MAX_ADJUSTMENT_KCAL = 300;
/** Energy in one kg of body weight change (the common 7700 kcal/kg rule of thumb). */
export const KCAL_PER_KG_BODY_WEIGHT = 7700;

/** Max number of results in food search. */
export const FOOD_SEARCH_MAX_RESULTS = 6;

/** Default unit when a quantity string doesn't include one. */
export const DEFAULT_QUANTITY_UNIT = 'g';
