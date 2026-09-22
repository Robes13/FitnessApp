import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import { FOOD_SEARCH_MAX_RESULTS } from '../constants/nutrition';
import { FoodItem } from '../models/food';
import { FoodLogService } from './food-log';

/** Placeholder for the response time of a product database lookup, so the UI shows its loading state. */
const DEFAULT_DELAY_MS = 250;

/** Response time for the search. Set to 0 in tests. */
export const FOOD_SEARCH_DELAY_MS = new InjectionToken<number>('FOOD_SEARCH_DELAY_MS', {
  providedIn: 'root',
  factory: () => DEFAULT_DELAY_MS,
});

/**
 * Search across the user's own items. Matches on name case-insensitively;
 * max 6 results.
 *
 * The app has no product database – it needs to come from the backend. Until then,
 * the search only finds the items the user has created themselves.
 */
@Injectable({ providedIn: 'root' })
export class FoodSearchService {
  private readonly delayMs = inject(FOOD_SEARCH_DELAY_MS);
  private readonly foodLog = inject(FoodLogService);

  search(query: string): Observable<readonly FoodItem[]> {
    const needle = query.trim().toLowerCase();
    const results = this.foodLog
      .customFoods()
      .map((food) => ({ ...food, isCustom: true }))
      .filter((food) => food.name.toLowerCase().includes(needle))
      .slice(0, FOOD_SEARCH_MAX_RESULTS);
    return timer(this.delayMs).pipe(map(() => results));
  }
}
