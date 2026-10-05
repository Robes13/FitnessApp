import { Injectable, inject } from '@angular/core';
import { Observable, map, of, startWith, switchMap, timer } from 'rxjs';
import {
  CATALOGUE_SEARCH_DEBOUNCE_MS,
  CATALOGUE_SEARCH_MIN_LENGTH,
  FOOD_SEARCH_MAX_RESULTS,
} from '../../constants/nutrition';
import { FoodItem } from '../../models/food';
import { normalizeName } from '../../utils/name';
import { FoodLogService } from '../food-log/food-log';

/**
 * Search across the user's own foods (the loaded catalogue) and the API's shared catalogue
 * (Open Food Facts products). Matches on name case-insensitively, own foods first, max 6 results.
 * The own matches come at once; the shared ones are added after a short pause in typing.
 */
@Injectable({ providedIn: 'root' })
export class FoodSearchService {
  private readonly foodLog = inject(FoodLogService);

  search(query: string): Observable<readonly FoodItem[]> {
    const needle = query.trim().toLowerCase();
    const own = this.foodLog
      .customFoods()
      .filter((food) => food.name.toLowerCase().includes(needle))
      .slice(0, FOOD_SEARCH_MAX_RESULTS);
    if (needle.length < CATALOGUE_SEARCH_MIN_LENGTH || own.length >= FOOD_SEARCH_MAX_RESULTS) {
      return of(own);
    }
    const ownNames = new Set(own.map((food) => normalizeName(food.name)));
    return timer(CATALOGUE_SEARCH_DEBOUNCE_MS).pipe(
      switchMap(() => this.foodLog.searchCatalogue(query.trim(), FOOD_SEARCH_MAX_RESULTS)),
      map((catalogue) =>
        [...own, ...catalogue.filter((food) => !ownNames.has(normalizeName(food.name)))].slice(
          0,
          FOOD_SEARCH_MAX_RESULTS,
        ),
      ),
      startWith(own),
    );
  }
}
