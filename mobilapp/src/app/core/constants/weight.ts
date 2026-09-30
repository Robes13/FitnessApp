import { WeightRange } from '../models/weight';

/** Weigh-in endpoints, relative to `API_BASE_URL`. */
export const WEIGHT_ENDPOINT = {
  LOGS: 'me/weight-logs',
  /** The newest weigh-in, or the starting weight from sign-up without one. */
  LATEST: 'me/weight-logs/latest',
} as const;

/**
 * How many weigh-ins `load()` fetches (one page). There is at most one per day, so 100 cover
 * more than the 3 months the screen shows.
 *
 * ponytail: one page – older weigh-ins aren't loaded. Follow `nextCursor` with
 * `fetchAllPages()` once something needs them.
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
