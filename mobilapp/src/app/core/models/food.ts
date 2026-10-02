import { MealId } from './meal';

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem extends Macros {
  id: string;
  name: string;
  /** The portion the macros apply to, e.g. `'250 g'` or `'1 portion'`. */
  quantity: string;
  brand?: string;
  /** A new custom food's barcode – the scanner didn't find it (3.1-6a), so it's saved with the food. */
  barcode?: string;
  isCustom?: boolean;
}

export interface LoggedFood extends FoodItem {
  logId: string;
  meal: MealId;
  /** ISO date-time for the log entry. */
  loggedAt: string;
}

/** An item of a collection. `mealItemId` is the API's id – absent until the item is saved. */
export type CollectionItem = FoodItem & { readonly mealItemId?: number };

export interface FoodCollection {
  /** `String(mealCollectionId)`. */
  id: string;
  name: string;
  items: readonly CollectionItem[];
}

export interface NewCollectionInput {
  name: string;
  items: readonly CollectionItem[];
}

/** One day's summed macros from the food log. `entryCount` is 0 on days without a log. */
export interface DailyFoodTotals {
  /** Local date `YYYY-MM-DD`. */
  readonly date: string;
  readonly totals: Macros;
  readonly entryCount: number;
}

/** The editable nutrition fields of a custom food. */
export type CustomFoodInput = Omit<FoodItem, 'id' | 'isCustom'>;
