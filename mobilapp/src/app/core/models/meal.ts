export type MealId = 'morgen' | 'frokost' | 'aften' | 'snack';

export interface MealDefinition {
  readonly id: MealId;
  /** Translation key of the meal's name. */
  readonly labelKey: string;
}
