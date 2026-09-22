import { Tone } from './tone';

export type MealId = 'morgen' | 'frokost' | 'aften' | 'snack';

export interface MealDefinition {
  readonly id: MealId;
  readonly label: string;
}

/** Farvetonen på et måltids ikonflise – designets `mealTints`. */
export type MealTone = Extract<Tone, 'accent' | 'positive' | 'selected' | 'negative'>;
