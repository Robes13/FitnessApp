import { MealDefinition, MealId, MealTone } from '../models/meal';

export const MEAL_IDS: readonly MealId[] = ['morgen', 'frokost', 'aften', 'snack'];

export const MEALS: readonly MealDefinition[] = [
  { id: 'morgen', label: 'Morgenmad' },
  { id: 'frokost', label: 'Frokost' },
  { id: 'aften', label: 'Aftensmad' },
  { id: 'snack', label: 'Snacks' },
];

/**
 * The design's `mealTints`: the color of a meal's icon tile. Both the Food screen's
 * collection list and the Collections screen's cards look this up, so the two screens
 * can't drift out of sync.
 */
export const MEAL_TONES: Readonly<Record<MealId, MealTone>> = {
  morgen: 'accent',
  frokost: 'positive',
  aften: 'selected',
  snack: 'negative',
};
