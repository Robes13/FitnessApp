import { MealDefinition, MealId, MealTone } from '../models/meal';

export const MEAL_IDS: readonly MealId[] = ['morgen', 'frokost', 'aften', 'snack'];

export const MEALS: readonly MealDefinition[] = [
  { id: 'morgen', label: 'Morgenmad' },
  { id: 'frokost', label: 'Frokost' },
  { id: 'aften', label: 'Aftensmad' },
  { id: 'snack', label: 'Snacks' },
];

/**
 * Designets `mealTints`: farven på et måltids ikonflise. Både Mad-skærmens samlingsliste og
 * Samlinger-skærmens kort slår op her, så de to skærme ikke kan komme ud af trit.
 */
export const MEAL_TONES: Readonly<Record<MealId, MealTone>> = {
  morgen: 'accent',
  frokost: 'positive',
  aften: 'selected',
  snack: 'negative',
};
