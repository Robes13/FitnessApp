import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { DOCUMENT, DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import {
  MonoTypeOperatorFunction,
  Observable,
  catchError,
  defer,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { BARCODE_SCANNER_TEXT_KEY, PRODUCT_ID_PREFIX } from '../../constants/barcode';
import {
  FOOD_API_PAGE_LIMIT,
  FOOD_ENDPOINT,
  FOOD_NAME_MAX_LENGTH,
  SERVING_GRAMS_PER_UNIT,
} from '../../constants/food';
import { MEAL_IDS, MEAL_TYPE_BY_MEAL } from '../../constants/meals';
import { CursorPage, StoreStatus } from '../../models/api';
import { ApiError } from '../../models/api-error';
import { CustomFoodInput, DailyFoodTotals, FoodItem, LoggedFood, Macros } from '../../models/food';
import {
  ApiQuantityUnit,
  CreateFoodLogRequest,
  CreateFoodRequest,
  FoodDto,
  FoodLogDto,
  FoodServingDto,
  UpdateFoodLogRequest,
  UpsertFoodServingRequest,
} from '../../models/food-api';
import { MealId } from '../../models/meal';
import { ParsedQuantity } from '../../models/nutrition';
import { ApiErrorResolver, fetchAllPages, injectApiUrl, toApiError } from '../../utils/api';
import { addDays, startOfDay, toIsoDate } from '../../utils/date-format';
import { normalizeName } from '../../utils/name';
import { NOW } from '../../utils/now';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';
import { ProductLookupService } from '../product-lookup/product-lookup';
import { SessionDataStore } from '../session-data/session-data';
import { toApiUnit, toFoodItem, toLoggedFood, toPer100 } from './food-log-mapping';

/** How many days (today included) `load()` fetches – Home's 30-day sheet lies inside them. */
export const FOOD_LOG_RETENTION_DAYS = 90;

/** Prefix of the ids of custom foods that aren't saved in the API yet (the picker's new food). */
export const CUSTOM_FOOD_ID_PREFIX = 'food';

/** `off-<barcode>`: a product looked up by barcode that isn't in the catalogue yet. */
const SCANNED_ID_PREFIX = `${PRODUCT_ID_PREFIX}-`;
/** DELETE/PATCH of a log that is already gone (e.g. removed on another device). */
const LOG_NOT_FOUND_MESSAGE_KEY = 'food.page.notFound';
const LOG_NOT_FOUND: ApiErrorResolver = (problem) =>
  problem.status === HttpStatusCode.NotFound ? LOG_NOT_FOUND_MESSAGE_KEY : null;
const PRODUCT_LOOKUP_FAILED: ApiError = { messageKey: BARCODE_SCANNER_TEXT_KEY.LOOKUP_ERROR };

/** Errors `addCustomFood()`/`add()` when the API already has a food with the name (409). */
export class DuplicateCustomFoodNameError extends Error {
  constructor(readonly foodName: string) {
    super(`A custom food named "${foodName}" already exists.`);
    this.name = 'DuplicateCustomFoodNameError';
  }
}

const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
const NO_ENTRIES: readonly LoggedFood[] = [];

/**
 * The user's food catalogue (`foods`) and food log of the last `FOOD_LOG_RETENTION_DAYS` days,
 * from the API.
 *
 * `entries` / `totals` / `byMeal` always describe today; when the date changes they switch to
 * the new (empty) day while earlier days stay readable via `entriesFor` / `totalsFor` /
 * `dailyTotals` / `allEntries`.
 *
 * Every mutation is pessimistic: memory changes from the API's answer, never before. A failed
 * mutation errors with an `ApiError` (or a `DuplicateCustomFoodNameError`) and changes nothing.
 * `load()` never errors – a failure sets `status` to `'error'`.
 */
@Injectable({ providedIn: 'root' })
export class FoodLogService implements SessionDataStore {
  private readonly http = inject(HttpClient);
  private readonly url = injectApiUrl();
  private readonly now = inject(NOW);
  private readonly document = inject(DOCUMENT);
  private readonly calculator = inject(NutritionCalculator);
  private readonly productLookup = inject(ProductLookupService);
  private readonly activeDate = signal(this.currentIsoDate());
  private readonly statusState = signal<StoreStatus>('idle');
  private readonly foodsState = signal<readonly FoodDto[]>([]);
  private readonly logsState = signal<readonly LoggedFood[]>([]);
  /** Local date (`YYYY-MM-DD`) → that day's entries in logged order. */
  private readonly days = computed(() => groupByDay(this.logsState()));

  readonly status: Signal<StoreStatus> = this.statusState.asReadonly();
  /** The user's own catalogue, newest first (the API has no shared food database). */
  readonly foods: Signal<readonly FoodDto[]> = this.foodsState.asReadonly();
  /**
   * Today's local date (`YYYY-MM-DD`). Changes at midnight and when the app returns to the
   * foreground on a new day, so a `computed()` that reads it stays current across midnight.
   */
  readonly today: Signal<string> = this.activeDate.asReadonly();
  readonly entries: Signal<readonly LoggedFood[]> = computed(
    () => this.days().get(this.activeDate()) ?? NO_ENTRIES,
  );
  /** The catalogue as picker items, newest first. */
  readonly customFoods: Signal<readonly FoodItem[]> = computed(() =>
    this.foodsState().map(toFoodItem),
  );
  readonly totals: Signal<Macros> = computed(() => sumMacros(this.entries()));
  readonly byMeal: Signal<ReadonlyMap<MealId, readonly LoggedFood[]>> = computed(() => {
    const groups = new Map<MealId, LoggedFood[]>(MEAL_IDS.map((meal) => [meal, []]));
    for (const entry of this.entries()) {
      groups.get(entry.meal)?.push(entry);
    }
    return groups;
  });
  /** Every loaded entry across all days, newest day first (in logged order within a day). */
  readonly allEntries: Signal<readonly LoggedFood[]> = computed(() =>
    [...this.days()].sort(([a], [b]) => (a < b ? 1 : -1)).flatMap(([, entries]) => entries),
  );

  constructor() {
    let midnightTimer: ReturnType<typeof setTimeout>;
    const refresh = (): void => {
      clearTimeout(midnightTimer);
      this.ensureCurrentDay();
      const now = this.now();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      midnightTimer = setTimeout(refresh, midnight.getTime() - now.getTime());
    };
    refresh();
    this.document.addEventListener?.('visibilitychange', refresh);
    this.document.defaultView?.addEventListener?.('focus', refresh);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(midnightTimer);
      this.document.removeEventListener?.('visibilitychange', refresh);
      this.document.defaultView?.removeEventListener?.('focus', refresh);
    });
  }

  /** The catalogue and the log from the start of today − 89 until tomorrow (local days), every page. */
  load(): Observable<void> {
    return defer(() => {
      this.statusState.set('loading');
      this.ensureCurrentDay();
      const today = startOfDay(this.now());
      const range = {
        from: addDays(today, 1 - FOOD_LOG_RETENTION_DAYS).toISOString(),
        to: addDays(today, 1).toISOString(),
      };
      return forkJoin({
        foods: fetchAllPages((cursor) =>
          this.http.get<CursorPage<FoodDto>>(this.url(FOOD_ENDPOINT.FOODS), {
            params: pageParams(cursor),
          }),
        ),
        logs: fetchAllPages((cursor) =>
          this.http.get<CursorPage<FoodLogDto>>(this.url(FOOD_ENDPOINT.FOOD_LOGS), {
            params: { ...range, ...pageParams(cursor) },
          }),
        ),
      });
    }).pipe(
      map(({ foods, logs }) => {
        this.foodsState.set(foods);
        this.logsState.set(logs.map(toLoggedFood));
        this.statusState.set('ready');
      }),
      catchError(() => {
        this.statusState.set('error');
        return of(undefined);
      }),
    );
  }

  /** Forgets the account's catalogue and log – memory only. */
  reset(): void {
    this.foodsState.set([]);
    this.logsState.set([]);
    this.statusState.set('idle');
  }

  /** The entries logged on the given local day. Reactive when read inside `computed()`. */
  entriesFor(date: Date): readonly LoggedFood[] {
    return this.days().get(toIsoDate(date)) ?? NO_ENTRIES;
  }

  totalsFor(date: Date): Macros {
    return sumMacros(this.entriesFor(date));
  }

  /** One row per day from `from` to `to` (both included), also for days without a log. */
  dailyTotals(from: Date, to: Date): readonly DailyFoodTotals[] {
    const rows: DailyFoodTotals[] = [];
    const last = toIsoDate(to);
    for (let day = startOfDay(from); toIsoDate(day) <= last; day = addDays(day, 1)) {
      const entries = this.entriesFor(day);
      rows.push({ date: toIsoDate(day), totals: sumMacros(entries), entryCount: entries.length });
    }
    return rows;
  }

  /** Logs `food` (`quantity` e.g. `'150 g'`) now under `meal`, after `ensureFood()`. */
  add(food: FoodItem, meal: MealId): Observable<LoggedFood> {
    return this.ensureFood(food).pipe(
      switchMap((saved) => {
        this.ensureCurrentDay();
        const body: CreateFoodLogRequest = {
          foodId: saved.foodId,
          ...this.toLogQuantity(food.quantity),
          consumedAt: this.now().toISOString(),
          mealType: MEAL_TYPE_BY_MEAL[meal],
        };
        return this.http.post<FoodLogDto>(this.url(FOOD_ENDPOINT.FOOD_LOGS), body);
      }),
      map((log) => {
        const entry = toLoggedFood(log);
        this.logsState.update((logs) => [...logs, entry]);
        return entry;
      }),
      mapFoodError(),
    );
  }

  /** Puts rows the API has already logged (e.g. a logged collection) into memory. */
  addLogs(logs: readonly FoodLogDto[]): void {
    this.logsState.update((current) => [...current, ...logs.map(toLoggedFood)]);
  }

  /** Changes only the amount (spec 3.3); the API recalculates the values and keeps the meal. */
  update(logId: string, patch: Pick<FoodItem, 'quantity'>): Observable<LoggedFood> {
    return defer(() => {
      const body: UpdateFoodLogRequest = this.toLogQuantity(patch.quantity);
      return this.http.patch<FoodLogDto>(this.url(FOOD_ENDPOINT.foodLog(logId)), body);
    }).pipe(
      map((log) => {
        const entry = toLoggedFood(log);
        this.logsState.update((logs) => logs.map((row) => (row.logId === logId ? entry : row)));
        return entry;
      }),
      this.mapLogError(logId),
    );
  }

  /** A 404 (already removed, e.g. on another device) drops the entry too, then errors. */
  remove(logId: string): Observable<void> {
    return this.http.delete<void>(this.url(FOOD_ENDPOINT.foodLog(logId))).pipe(
      map(() => this.dropLog(logId)),
      this.mapLogError(logId),
    );
  }

  /**
   * Saves a custom food, described per portion (`'2 stk'`), as the API's per-100 values plus the
   * serving its unit needs. A catalogue food with the same name is reused, so a retry after a
   * failed serving only adds the serving (the picker only lets an unchanged form retry). A name
   * taken in the API (409) errors with `DuplicateCustomFoodNameError`.
   */
  addCustomFood(input: CustomFoodInput): Observable<FoodItem> {
    return defer(() => {
      const quantity = this.calculator.parseQuantity(input.quantity);
      return this.ensureOwnFood(input, quantity).pipe(
        switchMap((food) => this.ensureServing(food, toApiUnit(quantity.unit))),
      );
    }).pipe(map(toFoodItem), mapFoodError());
  }

  /**
   * The API food behind a picker item: a catalogue id is that food; a scanned product
   * (`off-<barcode>`) is the catalogue food with that barcode or a new one from the product's
   * per-100 values (a taken name is retried once as `name (brand or barcode)`); any other item
   * (an unsaved custom food, or a collection item under its own id) is the catalogue food with
   * the same name or a new one from the item's own portion. Then the serving the item's unit
   * needs is created when it's missing (idempotent – it also heals a half-created food).
   */
  ensureFood(item: FoodItem): Observable<FoodDto> {
    return defer(() => {
      const quantity = this.calculator.parseQuantity(item.quantity);
      const food = item.id.startsWith(SCANNED_ID_PREFIX)
        ? this.ensureScannedFood(item.id.slice(SCANNED_ID_PREFIX.length))
        : this.ensureOwnFood(item, quantity);
      return food.pipe(switchMap((saved) => this.ensureServing(saved, toApiUnit(quantity.unit))));
    }).pipe(mapFoodError());
  }

  /** Case-insensitive, trimmed name match against the catalogue – the API's 409 rule. */
  hasCustomFoodNamed(name: string): boolean {
    const needle = normalizeName(name);
    return this.foodsState().some((food) => normalizeName(food.name) === needle);
  }

  private ensureOwnFood(
    item: CustomFoodInput & Partial<Pick<FoodItem, 'id'>>,
    quantity: ParsedQuantity,
  ): Observable<FoodDto> {
    const foods = this.foodsState();
    const name = normalizeName(item.name);
    const existing =
      foods.find((food) => String(food.foodId) === item.id) ??
      foods.find((food) => normalizeName(food.name) === name);
    return existing ? of(existing) : this.createOwnFood(item, quantity);
  }

  /** The product comes from `ProductLookupService`, which answers a scanned barcode from its cache. */
  private ensureScannedFood(barcode: string): Observable<FoodDto> {
    const existing = this.foodsState().find((food) => food.barcode === barcode);
    if (existing) {
      return of(existing);
    }
    return this.productLookup.lookup(barcode).pipe(
      switchMap((result) => {
        if (result.status !== 'found') {
          return throwError(() => PRODUCT_LOOKUP_FAILED);
        }
        const { item } = result.product;
        const request: CreateFoodRequest = {
          name: foodName(item.name),
          barcode,
          caloriesPer100: item.kcal,
          proteinPer100: item.protein,
          carbohydratesPer100: item.carbs,
          fatPer100: item.fat,
        };
        return this.createFood(request).pipe(
          catchError((error: unknown) =>
            error instanceof DuplicateCustomFoodNameError
              ? this.createFood({ ...request, name: foodName(item.name, item.brand ?? barcode) })
              : throwError(() => error),
          ),
        );
      }),
    );
  }

  private createOwnFood(input: CustomFoodInput, quantity: ParsedQuantity): Observable<FoodDto> {
    return this.createFood({ name: foodName(input.name), ...toPer100({ ...input, ...quantity }) });
  }

  /** `POST foods`; a 409 becomes `DuplicateCustomFoodNameError`. The new food goes first. */
  private createFood(request: CreateFoodRequest): Observable<FoodDto> {
    return this.http.post<FoodDto>(this.url(FOOD_ENDPOINT.FOODS), request).pipe(
      tap((food) => this.foodsState.update((foods) => [food, ...foods])),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof HttpErrorResponse && error.status === HttpStatusCode.Conflict
            ? new DuplicateCustomFoodNameError(request.name)
            : error,
        ),
      ),
    );
  }

  /** `PUT foods/{id}/servings/{unit}` when a unit other than grams has no serving yet. */
  private ensureServing(food: FoodDto, unit: ApiQuantityUnit): Observable<FoodDto> {
    const gramsPerUnit = SERVING_GRAMS_PER_UNIT[unit];
    if (gramsPerUnit === undefined || food.servings.some((serving) => serving.unit === unit)) {
      return of(food);
    }
    const body: UpsertFoodServingRequest = { gramsPerUnit };
    return this.http
      .put<FoodServingDto>(this.url(FOOD_ENDPOINT.serving(food.foodId, unit)), body)
      .pipe(
        map((serving) => {
          const updated: FoodDto = { ...food, servings: [...food.servings, serving] };
          this.foodsState.update((foods) =>
            foods.map((candidate) => (candidate.foodId === food.foodId ? updated : candidate)),
          );
          return updated;
        }),
      );
  }

  private toLogQuantity(quantity: string): { quantity: number; unit: ApiQuantityUnit } {
    const parsed = this.calculator.parseQuantity(quantity);
    return { quantity: parsed.amount, unit: toApiUnit(parsed.unit) };
  }

  private mapLogError<T>(logId: string): MonoTypeOperatorFunction<T> {
    return catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound) {
        this.dropLog(logId);
      }
      return throwError(() => toApiError(error, LOG_NOT_FOUND));
    });
  }

  private dropLog(logId: string): void {
    this.logsState.update((logs) => logs.filter((row) => row.logId !== logId));
  }

  private ensureCurrentDay(): void {
    const today = this.currentIsoDate();
    if (today !== this.activeDate()) {
      this.activeDate.set(today);
    }
  }

  private currentIsoDate(): string {
    return toIsoDate(this.now());
  }
}

/** `mapApiError()` that lets a `DuplicateCustomFoodNameError` through for the caller's message. */
function mapFoodError<T>(): MonoTypeOperatorFunction<T> {
  return catchError((error: unknown) =>
    throwError(() => (error instanceof DuplicateCustomFoodNameError ? error : toApiError(error))),
  );
}

function pageParams(cursor: string | null): Record<string, string | number> {
  return cursor === null ? { limit: FOOD_API_PAGE_LIMIT } : { limit: FOOD_API_PAGE_LIMIT, cursor };
}

/** The trimmed name, cut to the API's 150 characters – keeping room for a ` (suffix)`. */
function foodName(name: string, suffix?: string): string {
  const tail = suffix === undefined ? '' : ` (${suffix})`;
  const head = name.trim().slice(0, Math.max(0, FOOD_NAME_MAX_LENGTH - tail.length));
  return `${head}${tail}`.slice(0, FOOD_NAME_MAX_LENGTH);
}

/** Local date → entries, each day in logged order. */
function groupByDay(logs: readonly LoggedFood[]): ReadonlyMap<string, readonly LoggedFood[]> {
  const days = new Map<string, LoggedFood[]>();
  for (const entry of [...logs].sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt))) {
    const date = toIsoDate(new Date(entry.loggedAt));
    const day = days.get(date);
    if (day) {
      day.push(entry);
    } else {
      days.set(date, [entry]);
    }
  }
  return days;
}

function sumMacros(entries: readonly LoggedFood[]): Macros {
  return entries.reduce<Macros>(
    (sum, entry) => ({
      kcal: sum.kcal + entry.kcal,
      protein: sum.protein + entry.protein,
      carbs: sum.carbs + entry.carbs,
      fat: sum.fat + entry.fat,
    }),
    EMPTY_MACROS,
  );
}
