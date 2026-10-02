import { WeightRange } from '../models/weight';

/**
 * Weigh-in endpoints, relative to `API_BASE_URL`. The newest weigh-in (or the starting weight) is
 * `PROFILE_ENDPOINT.LATEST_WEIGHT`.
 */
export const WEIGHT_ENDPOINT = {
  LOGS: 'me/weight-logs',
} as const;

/**
 * The page size of `load()`, the API's maximum. `load()` follows the pages, because Home's goal
 * progress and the "kg lost" achievements start from the user's very first weigh-in.
 */
export const WEIGHT_LOG_LOAD_LIMIT = 100;

export const WEIGHT_RANGE_DAYS: Readonly<Record<WeightRange, number>> = {
  '1u': 7,
  '3u': 21,
  '3m': 90,
};

/** Translation keys of the ranges' labels. */
export const WEIGHT_RANGE_LABEL_KEY: Readonly<Record<WeightRange, string>> = {
  '1u': 'core.weight.range.lastWeek',
  '3u': 'core.weight.range.lastThreeWeeks',
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
