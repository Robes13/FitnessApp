import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import {
  EMPTY,
  MonoTypeOperatorFunction,
  Observable,
  catchError,
  concat,
  defer,
  ignoreElements,
  map,
  of,
  switchMap,
  throwError,
  toArray,
} from 'rxjs';
import { API_ERROR_MESSAGE_KEY } from '../../constants/api';
import { COLLECTION_API_PAGE_LIMIT, COLLECTION_ENDPOINT } from '../../constants/collections';
import { TOKEN_BY_QUANTITY_UNIT } from '../../constants/food';
import { MEAL_TYPE_BY_MEAL } from '../../constants/meals';
import { CursorPage, StoreStatus } from '../../models/api';
import { ApiError } from '../../models/api-error';
import {
  CollectionItem,
  FoodCollection,
  FoodItem,
  Macros,
  NewCollectionInput,
} from '../../models/food';
import {
  CreateMealCollectionRequest,
  CreateMealItemRequest,
  FoodDto,
  FoodLogDto,
  LogMealCollectionRequest,
  MealCollectionDto,
  MealItemDto,
  UpdateMealCollectionRequest,
} from '../../models/food-api';
import { MealId } from '../../models/meal';
import { fetchAllPages, injectApiUrl, mapApiError, toApiError } from '../../utils/api';
import { normalizeName } from '../../utils/name';
import { NOW } from '../../utils/now';
import { DuplicateCustomFoodNameError, FoodLogService } from '../food-log/food-log';
import { toApiUnit } from '../food-log/food-log-mapping';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';
import { SessionDataStore } from '../session-data/session-data';

export type CollectionTotals = Macros & { count: number };

/** What failed, when the API's error is only the generic "request failed". */
const SAVE_ERROR_KEY = 'collections.saveError';
const LOG_ERROR_KEY = 'collections.logError';
/** A food's nutrition is per 100 g (`…Per100`). */
const PER_100_GRAMS = 100;
const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/**
 * The user's meal collections from the API (`me/meal-collections`).
 *
 * `MealItemDto` has no nutrition, so `collections` scales each item's food from
 * `FoodLogService.foods` (an item shows 0 until the catalogue is loaded). Every mutation is
 * pessimistic and errors with an `ApiError`; `load()` never errors – a failure sets `status` to
 * `'error'`. Names are unique only in the app (`isNameTaken`) – the API accepts duplicates.
 */
@Injectable({ providedIn: 'root' })
export class CollectionsService implements SessionDataStore {
  private readonly http = inject(HttpClient);
  private readonly url = injectApiUrl();
  private readonly now = inject(NOW);
  private readonly calculator = inject(NutritionCalculator);
  private readonly foodLog = inject(FoodLogService);
  private readonly statusState = signal<StoreStatus>('idle');
  /** The API's collections, newest first. */
  private readonly dtos = signal<readonly MealCollectionDto[]>([]);

  readonly status: Signal<StoreStatus> = this.statusState.asReadonly();
  readonly collections: Signal<readonly FoodCollection[]> = computed(() => {
    const foods = new Map(this.foodLog.foods().map((food) => [food.foodId, food]));
    return this.dtos().map((dto) => ({
      id: String(dto.mealCollectionId),
      name: dto.name,
      items: dto.items.map((item) => this.toItem(item, foods.get(item.foodId))),
    }));
  });

  /** Every page of the user's collections. */
  load(): Observable<void> {
    return defer(() => {
      this.statusState.set('loading');
      return fetchAllPages((cursor) =>
        this.http.get<CursorPage<MealCollectionDto>>(this.url(COLLECTION_ENDPOINT.COLLECTIONS), {
          params:
            cursor === null
              ? { limit: COLLECTION_API_PAGE_LIMIT }
              : { limit: COLLECTION_API_PAGE_LIMIT, cursor },
        }),
      );
    }).pipe(
      map((dtos) => {
        this.dtos.set(dtos);
        this.statusState.set('ready');
      }),
      catchError(() => {
        this.statusState.set('error');
        return of(undefined);
      }),
    );
  }

  /** Forgets the account's collections – memory only. */
  reset(): void {
    this.dtos.set([]);
    this.statusState.set('idle');
  }

  collectionById(id: string): FoodCollection | undefined {
    return this.collections().find((collection) => collection.id === id);
  }

  /**
   * Whether another collection already has the name (trimmed, case-insensitive). `exceptId` is
   * the collection being edited, so it doesn't clash with its own name.
   */
  isNameTaken(name: string, exceptId?: string): boolean {
    const wanted = normalizeName(name);
    return this.collections().some(
      (collection) => collection.id !== exceptId && normalizeName(collection.name) === wanted,
    );
  }

  collectionTotals(collection: FoodCollection): CollectionTotals {
    return collection.items.reduce<CollectionTotals>(
      (sum, item) => ({
        kcal: sum.kcal + item.kcal,
        protein: sum.protein + item.protein,
        carbs: sum.carbs + item.carbs,
        fat: sum.fat + item.fat,
        count: sum.count + 1,
      }),
      { ...EMPTY_MACROS, count: 0 },
    );
  }

  /** `ensureFood` for every item, one after the other, then `POST me/meal-collections`. */
  create(input: NewCollectionInput): Observable<void> {
    return concat(...input.items.map((item) => this.toItemRequest(item))).pipe(
      toArray(),
      switchMap((items) => {
        const body: CreateMealCollectionRequest = { name: input.name.trim(), items };
        return this.http.post<MealCollectionDto>(this.url(COLLECTION_ENDPOINT.COLLECTIONS), body);
      }),
      map((dto) => this.dtos.update((dtos) => [dto, ...dtos])),
      mapCollectionError(SAVE_ERROR_KEY),
    );
  }

  /**
   * Saves the draft as a diff (P13): `PATCH` the name if it changed → `POST` every item without
   * a `mealItemId` (after `ensureFood`) → `DELETE` every saved item the draft dropped (after the
   * POSTs, so one always remains) → `GET` the collection. Not atomic: on any error the
   * collection is fetched again, so memory shows what the API kept, and the error is rethrown.
   */
  update(id: string, input: NewCollectionInput): Observable<void> {
    return defer(() => {
      const saved = this.dtos().find((dto) => String(dto.mealCollectionId) === id);
      const rename: UpdateMealCollectionRequest = { name: input.name.trim() };
      const kept = new Set(input.items.map((item) => item.mealItemId));
      const steps: Observable<unknown>[] = [
        ...(saved?.name === rename.name
          ? []
          : [this.http.patch(this.url(COLLECTION_ENDPOINT.collection(id)), rename)]),
        ...input.items
          .filter((item) => item.mealItemId === undefined)
          .map((item) =>
            this.toItemRequest(item).pipe(
              switchMap((body) => this.http.post(this.url(COLLECTION_ENDPOINT.items(id)), body)),
            ),
          ),
        ...(saved?.items ?? [])
          .filter((item) => !kept.has(item.mealItemId))
          .map((item) => this.http.delete(this.url(COLLECTION_ENDPOINT.item(id, item.mealItemId)))),
      ];
      return concat(...steps).pipe(
        toArray(),
        switchMap(() => this.fetch(id)),
      );
    }).pipe(
      catchError((error: unknown) =>
        concat(
          this.fetch(id).pipe(
            ignoreElements(),
            catchError(() => EMPTY),
          ),
          throwError(() => error),
        ),
      ),
      mapCollectionError(SAVE_ERROR_KEY),
    );
  }

  /** `DELETE`; the food logs made from the collection stay. A 404 (already gone) counts as removed. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(this.url(COLLECTION_ENDPOINT.collection(id))).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(undefined)
          : throwError(() => error),
      ),
      map(() =>
        this.dtos.update((dtos) => dtos.filter((dto) => String(dto.mealCollectionId) !== id)),
      ),
      mapApiError(),
    );
  }

  /** Logs every item now under `meal` – one food log row each (P13) – and puts the rows in the log. */
  log(id: string, meal: MealId): Observable<void> {
    return defer(() => {
      const body: LogMealCollectionRequest = {
        consumedAt: this.now().toISOString(),
        mealType: MEAL_TYPE_BY_MEAL[meal],
        multiplier: 1,
      };
      return this.http.post<FoodLogDto[]>(this.url(COLLECTION_ENDPOINT.log(id)), body);
    }).pipe(
      map((logs) => this.foodLog.addLogs(logs)),
      mapCollectionError(LOG_ERROR_KEY),
    );
  }

  /** `GET` one collection into memory. */
  private fetch(id: string): Observable<void> {
    return this.http
      .get<MealCollectionDto>(this.url(COLLECTION_ENDPOINT.collection(id)))
      .pipe(
        map((fresh) =>
          this.dtos.update((dtos) =>
            dtos.map((dto) => (dto.mealCollectionId === fresh.mealCollectionId ? fresh : dto)),
          ),
        ),
      );
  }

  /** The API food behind the item (created if needed) with the item's amount and unit. */
  private toItemRequest(item: FoodItem): Observable<CreateMealItemRequest> {
    return this.foodLog.ensureFood(item).pipe(
      map((food) => {
        const { amount, unit } = this.calculator.parseQuantity(item.quantity);
        return { foodId: food.foodId, quantity: amount, unit: toApiUnit(unit) };
      }),
    );
  }

  /** The item with its food's per-100 values scaled to its amount – the API's own formula. */
  private toItem(item: MealItemDto, food: FoodDto | undefined): CollectionItem {
    const gramsPerUnit =
      item.unit === 'Gram'
        ? 1
        : (food?.servings.find((serving) => serving.unit === item.unit)?.gramsPerUnit ?? 1);
    const per100: Macros = food
      ? {
          kcal: food.caloriesPer100,
          protein: food.proteinPer100,
          carbs: food.carbohydratesPer100,
          fat: food.fatPer100,
        }
      : EMPTY_MACROS;
    return {
      id: String(item.foodId),
      mealItemId: item.mealItemId,
      name: item.foodName,
      quantity: `${item.quantity} ${TOKEN_BY_QUANTITY_UNIT[item.unit]}`,
      ...this.calculator.scaleMacros(per100, (item.quantity * gramsPerUnit) / PER_100_GRAMS),
    };
  }
}

/**
 * Rethrows every failure as an `ApiError` that says what failed (`fallbackKey`) instead of the
 * generic "request failed"; network and server errors keep their text. A food name taken on
 * another device while `ensureFood` ran is such a failure too.
 */
function mapCollectionError<T>(fallbackKey: string): MonoTypeOperatorFunction<T> {
  return catchError((error: unknown) => {
    const apiError: ApiError =
      error instanceof DuplicateCustomFoodNameError
        ? { messageKey: fallbackKey }
        : toApiError(error);
    return throwError(() =>
      apiError.messageKey === API_ERROR_MESSAGE_KEY.REQUEST_FAILED
        ? { ...apiError, messageKey: fallbackKey }
        : apiError,
    );
  });
}
