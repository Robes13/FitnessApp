import {
  ActivityLevel,
  Gender,
  GenderDefinition,
  GoalDefinition,
  IntensityDefinition,
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

/** Designets `actLevels`. Niveauet vælges som det første, hvor skridt < `maxSteps`. */
export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  { maxSteps: 2500, pal: 1.25, label: 'Stillesiddende' },
  { maxSteps: 5500, pal: 1.4, label: 'Let aktiv' },
  { maxSteps: 9000, pal: 1.55, label: 'Aktiv' },
  { maxSteps: 13000, pal: 1.7, label: 'Meget aktiv' },
  { maxSteps: 18000, pal: 1.85, label: 'Ekstremt aktiv' },
  { maxSteps: 99999, pal: 1.95, label: 'Maratonklar' },
];

/** Designets `intDef`. Et RPE-tal mappes til det første niveau, hvor rpe <= `maxRpe`. */
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

/** Andel af dagens kalorier pr. makro (designets 30/45/25). */
export const MACRO_SPLIT: Readonly<Omit<Macros, 'kcal'>> = { protein: 0.3, carbs: 0.45, fat: 0.25 };
export const KCAL_PER_GRAM: Readonly<Omit<Macros, 'kcal'>> = { protein: 4, carbs: 4, fat: 9 };

/** Mifflin-St Jeor: køns-konstant. `andet`/ukendt bruger gennemsnittet af de to. */
export const BMR_GENDER_OFFSET: Readonly<Record<Gender, number>> = {
  mand: 5,
  kvinde: -161,
  andet: -78,
};
export const BMR_WEIGHT_FACTOR = 10;
export const BMR_HEIGHT_FACTOR = 6.25;
export const BMR_AGE_FACTOR = 5;
/** Bruges i BMR, når fødselsdag ikke er angivet. */
export const BMR_FALLBACK_AGE = 30;
/** Kaloriebehov rundes til nærmeste 10. */
export const KCAL_ROUNDING = 10;

/** Målvægtens skala (designets `gMin`/`gMax`). */
export const GOAL_WEIGHT_MIN_KG = 35;
export const GOAL_WEIGHT_MIN_SPAN_KG = 36;
export const GOAL_WEIGHT_MAX_KG = 200;
/** BMI-grænser for et realistisk mål ("for lavt" / "meget højt for din højde"). */
export const GOAL_BMI_MIN = 17;
export const GOAL_BMI_MAX = 35;

/** Omregning af skridt (designets `stepKm` / `stepKcal`). */
export const KM_PER_STEP = 0.00075;
export const KCAL_PER_STEP_PER_KG = 0.00045;

/** Max antal resultater i madsøgningen. */
export const FOOD_SEARCH_MAX_RESULTS = 6;

/** Standardenhed, når en portionstekst ikke indeholder en enhed. */
export const DEFAULT_QUANTITY_UNIT = 'g';
