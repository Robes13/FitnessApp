import { Tone } from './tone';

export type MealId = 'morgen' | 'frokost' | 'aften' | 'snack';

export interface MealDefinition {
  readonly id: MealId;
  /** Translation key of the meal's name. */
  readonly labelKey: string;
}

/** The color tone of a meal's icon tile – the design's `mealTints`. */
export type MealTone = Extract<Tone, 'accent' | 'positive' | 'selected' | 'negative'>;
