import { FoodItem } from '../models/food';
import { WeighEntry } from '../models/weight';

const MS_PER_DAY = 86_400_000;

/** A weigh-in `daysAgo` days before `now`, at the same time of day. */
export function weighEntry(id: string, kg: number, daysAgo: number, now: Date): WeighEntry {
  return { id, kg, at: new Date(now.getTime() - daysAgo * MS_PER_DAY).toISOString() };
}

/**
 * Three weigh-ins to test with, newest first: 75.0 kg 3 days ago, 75.6 kg 10 days ago
 * and 76.1 kg 20 days ago. The app doesn't seed anything itself – specs that need a
 * weigh-in history put it here in storage.
 */
export function weighHistory(now: Date): readonly WeighEntry[] {
  return [
    weighEntry('w-1', 75, 3, now),
    weighEntry('w-2', 75.6, 10, now),
    weighEntry('w-3', 76.1, 20, now),
  ];
}

/** An item to log in tests. */
export const TEST_FOOD: FoodItem = {
  id: 'food-proteinbar',
  name: 'Proteinbar',
  quantity: '55 g',
  kcal: 210,
  protein: 20,
  carbs: 22,
  fat: 7,
};
