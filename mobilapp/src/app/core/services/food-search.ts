import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import { FOOD_DATABASE } from '../constants/demo-data';
import { FOOD_SEARCH_MAX_RESULTS } from '../constants/nutrition';
import { FOOD_SEARCH_DEFAULT_DELAY_MS } from '../constants/timing';
import { FoodItem } from '../models/food';
import { FoodLogService } from './food-log';

/** Svartid for søgningen. Sæt til 0 i tests. */
export const FOOD_SEARCH_DELAY_MS = new InjectionToken<number>('FOOD_SEARCH_DELAY_MS', {
  providedIn: 'root',
  factory: () => FOOD_SEARCH_DEFAULT_DELAY_MS,
});

/**
 * Søgning i brugerens egne varer (først, markeret `isCustom`) og den syntetiske
 * varedatabase. Matcher på navn uden hensyn til store/små bogstaver; max 6 resultater.
 */
@Injectable({ providedIn: 'root' })
export class FoodSearchService {
  private readonly delayMs = inject(FOOD_SEARCH_DELAY_MS);
  private readonly foodLog = inject(FoodLogService);

  search(query: string): Observable<readonly FoodItem[]> {
    const needle = query.trim().toLowerCase();
    const custom = this.foodLog.customFoods().map((food) => ({ ...food, isCustom: true }));
    const results = [...custom, ...FOOD_DATABASE]
      .filter((food) => food.name.toLowerCase().includes(needle))
      .slice(0, FOOD_SEARCH_MAX_RESULTS);
    return timer(this.delayMs).pipe(map(() => results));
  }
}
