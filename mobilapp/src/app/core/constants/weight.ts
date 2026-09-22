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

/**
 * How far back the weigh-in list reaches ("see weigh-ins at most 3 months back"). It reuses the
 * chart's 3-month range so the list and the longest chart range always cover the same period.
 */
export const WEIGHT_LOG_HISTORY_RANGE: WeightRange = '3m';

/** Labels in the weigh-in list ("Seneste vejninger"). */
export const WEIGHT_LOG_LIST_TEXT = {
  showFewer: 'Vis færre',
  showAll: (hiddenCount: number): string => `Vis alle (${hiddenCount} mere)`,
  editRow: (date: string, time: string, kg: string): string =>
    `Ret vejning ${date} kl. ${time}, ${kg} kg`,
} as const;
