import { DOCUMENT, DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { newId } from '../../utils/id';
import { normalizeName } from '../../utils/name';
import { MEAL_IDS } from '../../constants/meals';
import { STORAGE_KEY } from '../../constants/storage-key';
import { CustomFoodInput, DailyFoodTotals, FoodItem, LoggedFood, Macros } from '../../models/food';
import { MealId } from '../../models/meal';
import { addDays, startOfDay, toIsoDate } from '../../utils/date-format';
import { NOW } from '../../utils/now';
import { StorageService } from '../storage/storage';

/** How many days (today included) the food log keeps. Older days are pruned. */
export const FOOD_LOG_RETENTION_DAYS = 90;

/** Local date (`YYYY-MM-DD`) → the entries logged that day. */
type FoodLogDays = Readonly<Record<string, readonly LoggedFood[]>>;

interface StoredFoodLog {
  days: FoodLogDays;
}

/** The format before multi-day history: only one day was stored. */
interface LegacyStoredFoodLog {
  date: string;
  entries: readonly LoggedFood[];
}

/** Prefix for ids of the user's own foods. */
export const CUSTOM_FOOD_ID_PREFIX = 'food';

/** Thrown by `addCustomFood()`/`updateCustomFood()` when another custom food has the name. */
export class DuplicateCustomFoodNameError extends Error {
  constructor(name: string) {
    super(`A custom food named "${name}" already exists.`);
    this.name = 'DuplicateCustomFoodNameError';
  }
}

const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
const NO_ENTRIES: readonly LoggedFood[] = [];

/**
 * The food log per day (the last `FOOD_LOG_RETENTION_DAYS` days) and the user's own items.
 *
 * `entries` / `totals` / `byMeal` always describe today; when the date changes they switch to
 * the new (empty) day while earlier days stay readable via `entriesFor` / `totalsFor` /
 * `dailyTotals` / `allEntries`. Only today's log can be changed.
 * Custom foods (`customFoods`) are stored separately.
 */
@Injectable({ providedIn: 'root' })
export class FoodLogService {
  private readonly storage = inject(StorageService);
  private readonly now = inject(NOW);
  private readonly document = inject(DOCUMENT);
  private readonly activeDate = signal(this.currentIsoDate());
  private readonly daysState = signal<FoodLogDays>(this.restoreDays());
  private readonly customFoodsState = signal<readonly FoodItem[]>(this.restoreCustomFoods());

  /**
   * Today's local date (`YYYY-MM-DD`). Changes at midnight and when the app returns to the
   * foreground on a new day, so a `computed()` that reads it stays current across midnight.
   */
  readonly today: Signal<string> = this.activeDate.asReadonly();
  readonly entries: Signal<readonly LoggedFood[]> = computed(
    () => this.daysState()[this.activeDate()] ?? NO_ENTRIES,
  );
  readonly customFoods: Signal<readonly FoodItem[]> = this.customFoodsState.asReadonly();
  readonly totals: Signal<Macros> = computed(() => sumMacros(this.entries()));
  readonly byMeal: Signal<ReadonlyMap<MealId, readonly LoggedFood[]>> = computed(() => {
    const groups = new Map<MealId, LoggedFood[]>(MEAL_IDS.map((meal) => [meal, []]));
    for (const entry of this.entries()) {
      groups.get(entry.meal)?.push(entry);
    }
    return groups;
  });
  /** Every retained entry across all days, newest day first (in logged order within a day). */
  readonly allEntries: Signal<readonly LoggedFood[]> = computed(() => {
    const days = this.daysState();
    return Object.keys(days)
      .sort()
      .reverse()
      .flatMap((date) => days[date] ?? NO_ENTRIES);
  });

  constructor() {
    this.prune();
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

  /** The entries logged on the given local day. Reactive when read inside `computed()`. */
  entriesFor(date: Date): readonly LoggedFood[] {
    return this.daysState()[toIsoDate(date)] ?? NO_ENTRIES;
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

  add(food: FoodItem, meal: MealId): LoggedFood {
    this.ensureCurrentDay();
    const entry: LoggedFood = {
      ...food,
      logId: newId('log'),
      meal,
      loggedAt: this.now().toISOString(),
    };
    this.setTodayEntries([...this.entries(), entry]);
    return entry;
  }

  /** Only today's entries can be changed; a stale id from yesterday is ignored. */
  update(logId: string, patch: Partial<Omit<LoggedFood, 'logId'>>): void {
    this.ensureCurrentDay();
    this.setTodayEntries(
      this.entries().map((entry) => (entry.logId === logId ? { ...entry, ...patch } : entry)),
    );
  }

  remove(logId: string): void {
    this.ensureCurrentDay();
    this.setTodayEntries(this.entries().filter((entry) => entry.logId !== logId));
  }

  /**
   * Custom foods are added at the front, so they also come first in search. `id` lets the
   * caller decide the id up front (e.g. the food picker, which logs the same item right after),
   * so the logged entry and the saved custom food share it.
   * @throws DuplicateCustomFoodNameError if the name is taken – check `hasCustomFoodNamed()` first.
   */
  addCustomFood(food: CustomFoodInput, id: string = newId(CUSTOM_FOOD_ID_PREFIX)): FoodItem {
    this.assertCustomFoodNameFree(food.name);
    const item: FoodItem = { ...food, id, isCustom: true };
    this.setCustomFoods([item, ...this.customFoodsState()]);
    return item;
  }

  /**
   * Replaces a custom food's name, portion and macros. Entries already logged keep the values
   * they were logged with – the caller updates the entry it is editing itself.
   * Returns the updated food, or `null` when no custom food has that id.
   * @throws DuplicateCustomFoodNameError if another custom food has the name.
   */
  updateCustomFood(id: string, food: CustomFoodInput): FoodItem | null {
    const existing = this.customFoodsState().find((candidate) => candidate.id === id);
    if (!existing) {
      return null;
    }
    this.assertCustomFoodNameFree(food.name, id);
    const updated: FoodItem = { ...food, id, isCustom: true };
    this.setCustomFoods(
      this.customFoodsState().map((candidate) => (candidate.id === id ? updated : candidate)),
    );
    return updated;
  }

  /** Case-insensitive, trimmed name match against the custom foods (optionally ignoring one id). */
  hasCustomFoodNamed(name: string, exceptId?: string): boolean {
    const needle = normalizeName(name);
    return this.customFoodsState().some(
      (food) => food.id !== exceptId && normalizeName(food.name) === needle,
    );
  }

  private assertCustomFoodNameFree(name: string, exceptId?: string): void {
    if (this.hasCustomFoodNamed(name, exceptId)) {
      throw new DuplicateCustomFoodNameError(name.trim());
    }
  }

  private ensureCurrentDay(): void {
    const today = this.currentIsoDate();
    if (today !== this.activeDate()) {
      this.activeDate.set(today);
      this.prune();
    }
  }

  private setTodayEntries(entries: readonly LoggedFood[]): void {
    const { [this.activeDate()]: _previous, ...others } = this.daysState();
    this.setDays(entries.length === 0 ? others : { ...others, [this.activeDate()]: entries });
  }

  private setDays(days: FoodLogDays): void {
    this.daysState.set(days);
    const stored: StoredFoodLog = { days };
    this.storage.write(STORAGE_KEY.FOOD_LOG, stored);
  }

  private setCustomFoods(foods: readonly FoodItem[]): void {
    this.customFoodsState.set(foods);
    this.storage.write(STORAGE_KEY.CUSTOM_FOODS, foods);
  }

  /** Drops days older than the retention window (and empty days). Writes only on change. */
  private prune(): void {
    const oldest = toIsoDate(addDays(this.now(), 1 - FOOD_LOG_RETENTION_DAYS));
    const days = this.daysState();
    const kept = Object.fromEntries(
      Object.entries(days).filter(([date, entries]) => date >= oldest && entries.length > 0),
    );
    if (Object.keys(kept).length !== Object.keys(days).length) {
      this.setDays(kept);
    }
  }

  /** Reads the stored log; the old single-day format `{ date, entries }` is migrated. */
  private restoreDays(): FoodLogDays {
    const stored = this.storage.read<StoredFoodLog | LegacyStoredFoodLog>(STORAGE_KEY.FOOD_LOG);
    if (stored === null || typeof stored !== 'object') {
      return {};
    }
    if ('days' in stored && typeof stored.days === 'object' && stored.days !== null) {
      // Malformed days (not an array) are dropped, so bad storage can't crash `prune()`.
      return Object.fromEntries(
        Object.entries(stored.days).filter(([, entries]) => Array.isArray(entries)),
      );
    }
    if ('date' in stored && Array.isArray(stored.entries)) {
      return { [stored.date]: stored.entries };
    }
    return {};
  }

  private restoreCustomFoods(): readonly FoodItem[] {
    return this.storage.read<readonly FoodItem[]>(STORAGE_KEY.CUSTOM_FOODS) ?? [];
  }

  private currentIsoDate(): string {
    return toIsoDate(this.now());
  }
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
