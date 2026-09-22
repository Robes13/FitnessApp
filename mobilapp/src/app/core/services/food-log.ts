import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { newId } from '../utils/id';
import { MEAL_IDS } from '../constants/meals';
import { STORAGE_KEY } from '../constants/storage-key';
import { FoodItem, LoggedFood, Macros } from '../models/food';
import { MealId } from '../models/meal';
import { toIsoDate } from '../utils/date-format';
import { NOW } from '../utils/now';
import { StorageService } from './storage';

interface StoredFoodLog {
  /** Local date (`YYYY-MM-DD`) the log applies to. A new day starts with an empty log. */
  date: string;
  entries: readonly LoggedFood[];
}

const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/**
 * Today's food log and the user's own items.
 *
 * The log is tied to today's date: if the app is opened on a new day, it starts empty.
 * Custom foods (`customFoods`) are stored separately and survive the day changing.
 */
@Injectable({ providedIn: 'root' })
export class FoodLogService {
  private readonly storage = inject(StorageService);
  private readonly now = inject(NOW);
  private readonly entriesState = signal<readonly LoggedFood[]>([]);
  private readonly customFoodsState = signal<readonly FoodItem[]>(this.restoreCustomFoods());

  readonly entries: Signal<readonly LoggedFood[]> = this.entriesState.asReadonly();
  readonly customFoods: Signal<readonly FoodItem[]> = this.customFoodsState.asReadonly();
  readonly totals: Signal<Macros> = computed(() =>
    this.entriesState().reduce<Macros>(
      (sum, entry) => ({
        kcal: sum.kcal + entry.kcal,
        protein: sum.protein + entry.protein,
        carbs: sum.carbs + entry.carbs,
        fat: sum.fat + entry.fat,
      }),
      EMPTY_MACROS,
    ),
  );
  readonly byMeal: Signal<ReadonlyMap<MealId, readonly LoggedFood[]>> = computed(() => {
    const groups = new Map<MealId, LoggedFood[]>(MEAL_IDS.map((meal) => [meal, []]));
    for (const entry of this.entriesState()) {
      groups.get(entry.meal)?.push(entry);
    }
    return groups;
  });

  constructor() {
    this.restoreEntries();
  }

  add(food: FoodItem, meal: MealId): LoggedFood {
    const entry: LoggedFood = {
      ...food,
      logId: newId('log'),
      meal,
      loggedAt: this.now().toISOString(),
    };
    this.setEntries([...this.entriesState(), entry]);
    return entry;
  }

  update(logId: string, patch: Partial<Omit<LoggedFood, 'logId'>>): void {
    this.setEntries(
      this.entriesState().map((entry) => (entry.logId === logId ? { ...entry, ...patch } : entry)),
    );
  }

  remove(logId: string): void {
    this.setEntries(this.entriesState().filter((entry) => entry.logId !== logId));
  }

  /** Custom foods are added at the front, so they also come first in search. */
  addCustomFood(food: Omit<FoodItem, 'id' | 'isCustom'>): FoodItem {
    const item: FoodItem = { ...food, id: newId('food'), isCustom: true };
    this.customFoodsState.set([item, ...this.customFoodsState()]);
    this.storage.write(STORAGE_KEY.CUSTOM_FOODS, this.customFoodsState());
    return item;
  }

  private setEntries(entries: readonly LoggedFood[]): void {
    this.entriesState.set(entries);
    const stored: StoredFoodLog = { date: this.today(), entries };
    this.storage.write(STORAGE_KEY.FOOD_LOG, stored);
  }

  private restoreEntries(): void {
    const stored = this.storage.read<StoredFoodLog>(STORAGE_KEY.FOOD_LOG);
    if (stored === null || stored.date !== this.today()) {
      return;
    }
    this.entriesState.set(stored.entries);
  }

  private restoreCustomFoods(): readonly FoodItem[] {
    return this.storage.read<readonly FoodItem[]>(STORAGE_KEY.CUSTOM_FOODS) ?? [];
  }

  private today(): string {
    return toIsoDate(this.now());
  }
}
