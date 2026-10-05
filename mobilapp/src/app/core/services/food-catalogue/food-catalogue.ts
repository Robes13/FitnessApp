import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { FOOD_ENDPOINT } from '../../constants/food';
import { CursorPage } from '../../models/api';
import { FoodDto } from '../../models/food-api';
import { injectApiUrl } from '../../utils/api';

/**
 * The API's shared, read-only food catalogue (products sold in Denmark from Open Food Facts,
 * `createdByUserId: null`). `GET foods` answers a name or barcode search with the user's own
 * foods and the catalogue; only the catalogue foods are returned here. Never errors – a failed
 * lookup is "nothing found", so the caller falls back to Open Food Facts or the own foods.
 */
@Injectable({ providedIn: 'root' })
export class FoodCatalogueService {
  private readonly http = inject(HttpClient);
  private readonly url = injectApiUrl();

  /** The catalogue food with `barcode`, or `null`. */
  findByBarcode(barcode: string): Observable<FoodDto | null> {
    return this.get({ barcode, limit: 1 }).pipe(map((foods) => foods[0] ?? null));
  }

  /** Catalogue foods whose name contains `query`, at most `limit`. */
  search(query: string, limit: number): Observable<readonly FoodDto[]> {
    return this.get({ query, limit });
  }

  private get(params: Record<string, string | number>): Observable<FoodDto[]> {
    return this.http.get<CursorPage<FoodDto>>(this.url(FOOD_ENDPOINT.FOODS), { params }).pipe(
      map((page) => page.items.filter((food) => food.createdByUserId === null)),
      catchError(() => of([])),
    );
  }
}
