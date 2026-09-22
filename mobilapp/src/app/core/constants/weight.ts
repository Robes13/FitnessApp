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
