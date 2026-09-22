import { GoalId } from '../models/profile';
import { WeightRange } from '../models/weight';

export const WEIGHT_RANGE_DAYS: Readonly<Record<WeightRange, number>> = {
  '1u': 7,
  '4u': 28,
  '3m': 90,
};

export const WEIGHT_RANGE_LABEL: Readonly<Record<WeightRange, string>> = {
  '1u': 'Sidste uge',
  '4u': 'Sidste 4 uger',
  '3m': 'Sidste 3 mdr.',
};

/** Den syntetiske vægtkurve fra designet (`pts`): 12 punkter med drift og let bølge. */
export const WEIGHT_SERIES_POINTS = 12;
export const WEIGHT_SERIES_DRIFT_KG: Readonly<Record<GoalId, number>> = {
  tabe: 2.6,
  hold: 0,
  tage: -2.4,
};
export const WEIGHT_SERIES_DRIFT_REFERENCE_DAYS = 28;
export const WEIGHT_SERIES_WOBBLE_FREQUENCY = 1.7;
export const WEIGHT_SERIES_WOBBLE_AMPLITUDE_KG = 0.35;
