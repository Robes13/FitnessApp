import { Tone } from './tone';

export type MealId = 'morgen' | 'frokost' | 'aften' | 'snack';

export interface MealDefinition {
  readonly id: MealId;
  readonly label: string;
}

/** The color tone of a meal's icon tile – the design's `mealTints`. */
export type MealTone = Extract<Tone, 'accent' | 'positive' | 'selected' | 'negative'>;
