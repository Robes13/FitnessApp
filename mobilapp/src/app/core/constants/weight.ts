import { WeightRange } from '../models/weight';

export const WEIGHT_RANGE_DAYS: Readonly<Record<WeightRange, number>> = {
  '1u': 7,
  '4u': 28,
  '3m': 90,
};

/** Translation keys of the ranges' labels. */
export const WEIGHT_RANGE_LABEL_KEY: Readonly<Record<WeightRange, string>> = {
  '1u': 'core.weight.range.lastWeek',
  '4u': 'core.weight.range.lastFourWeeks',
  '3m': 'core.weight.range.lastThreeMonths',
};

/**
 * How far back the weigh-in list reaches ("see weigh-ins at most 3 months back"). It reuses the
 * chart's 3-month range so the list and the longest chart range always cover the same period.
 */
export const WEIGHT_LOG_HISTORY_RANGE: WeightRange = '3m';

/** Translation keys of the labels in the weigh-in list ("Seneste vejninger"). */
export const WEIGHT_LOG_LIST_TEXT_KEY = {
  showFewer: 'core.weight.logList.showFewer',
  /** Params: `hiddenCount`. */
  showAll: 'core.weight.logList.showAll',
  /** Params: `date`, `time`, `kg`. */
  editRow: 'core.weight.logList.editRow',
} as const;
