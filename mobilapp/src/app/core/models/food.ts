import { CollectionIconName } from '../constants/collection-icons';
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
  isCustom?: boolean;
}

export interface LoggedFood extends FoodItem {
  logId: string;
  meal: MealId;
  /** ISO date-time for the log entry. */
  loggedAt: string;
}

export interface Ingredient {
  name: string;
  quantity: string;
}

export interface Recipe extends Macros {
  id: string;
  title: string;
  subtitle: string;
  meal: MealId;
  category: string;
  timeMinutes: number;
  servings: string;
  ingredients: readonly Ingredient[];
  steps: readonly string[];
}

export interface FoodCollection {
  id: string;
  name: string;
  icon: CollectionIconName;
  meal: MealId;
  isBase: boolean;
  recipeIds: readonly string[];
  items: readonly FoodItem[];
}

export interface NewCollectionInput {
  name: string;
  icon: CollectionIconName;
  meal: MealId;
  items: readonly FoodItem[];
}

export type ScanResult = { status: 'found'; item: FoodItem } | { status: 'unknown' };
