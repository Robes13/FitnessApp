import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { FOOD_SEARCH_MAX_RESULTS } from '../../constants/nutrition';
import { FoodItem } from '../../models/food';
import { FoodLogService } from '../food-log/food-log';

/**
 * Search across the user's own foods (the loaded catalogue – the API has no shared food
 * database). Matches on name case-insensitively, newest first, max 6 results.
 */
@Injectable({ providedIn: 'root' })
export class FoodSearchService {
  private readonly foodLog = inject(FoodLogService);

  search(query: string): Observable<readonly FoodItem[]> {
    const needle = query.trim().toLowerCase();
    return of(
      this.foodLog
        .customFoods()
        .filter((food) => food.name.toLowerCase().includes(needle))
        .slice(0, FOOD_SEARCH_MAX_RESULTS),
    );
  }
}
