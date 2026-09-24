import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { MEALS } from '../../../core/constants/meals';
import { Macros } from '../../../core/models/food';
import { MealId } from '../../../core/models/meal';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { WeightLogService } from '../../../core/services/weight-log/weight-log';
import {
  daysBetween,
  formatDayMonth,
  formatDecimal,
  formatInteger,
  formatWeekdayAbbreviated,
} from '../../../core/utils/date-format';
import { NOW } from '../../../core/utils/now';
import { HistoryEntry, HistoryFilter, HistoryFilterId, HistoryGroup } from '../models/history';

export const HISTORY_FILTERS: readonly HistoryFilter[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'vejning', label: 'Vejning' },
  { id: 'mad', label: 'Mad' },
  { id: 'maal', label: 'Mål' },
];

export const RELOG_LABEL = 'Log igen i dag';
export const RELOGGED_LABEL = 'Logget i dag';

/** How long "Logget i dag" stays on the button after a relog. */
export const RELOGGED_DURATION_MS = 2600;

const WEIGH_TITLE = 'Vejning';
const WEIGH_SUBTITLE = 'Vejning registreret';
const WEIGH_SUBTITLE_LATEST = 'Seneste vejning';

/**
 * Builds the history entries and groups them by day.
 *
 * The entries are the user's own: weigh-ins from `WeightLogService` and meals from
 * `FoodLogService.allEntries()` (the food log's retained history). A day with meals also gets
 * the day's summed kcal and macros. Goal changes aren't tracked yet.
 *
 * The service is provided by `HistoryPage` (not `providedIn: 'root'`), because both the
 * filter and the "Logget i dag" state belong to the screen and should reset when you leave it.
 */
@Injectable()
export class HistoryService {
  private readonly now = inject(NOW);
  private readonly weightLog = inject(WeightLogService);
  private readonly foodLog = inject(FoodLogService);

  private readonly filterState = signal<HistoryFilterId>('alle');
  private readonly reloggedState = signal<string | null>(null);
  private reloggedTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filters = HISTORY_FILTERS;
  readonly filter: Signal<HistoryFilterId> = this.filterState.asReadonly();

  /** All entries, newest first. */
  readonly entries: Signal<readonly HistoryEntry[]> = computed(() => this.buildEntries());

  readonly visibleEntries: Signal<readonly HistoryEntry[]> = computed(() => {
    const filter = this.filterState();
    return filter === 'alle'
      ? this.entries()
      : this.entries().filter((entry) => entry.kind === filter);
  });

  readonly groups: Signal<readonly HistoryGroup[]> = computed(() =>
    groupByDay(this.visibleEntries()).map((group) => ({
      ...group,
      foodSummary: this.foodSummaryFor(group.entries),
    })),
  );

  readonly isEmpty: Signal<boolean> = computed(() => this.groups().length === 0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearReloggedTimer());
  }

  setFilter(filter: HistoryFilterId): void {
    this.filterState.set(filter);
  }

  isRelogged(entry: HistoryEntry): boolean {
    return this.reloggedState() === entry.id;
  }

  relogLabel(entry: HistoryEntry): string {
    return this.isRelogged(entry) ? RELOGGED_LABEL : RELOG_LABEL;
  }

  /** Adds the meal back to today's log and shows "Logget i dag" for 2.6 seconds. */
  relog(entry: HistoryEntry): void {
    const { food, meal } = entry;
    if (!food || !meal) {
      return;
    }
    this.foodLog.add(food, meal);
    this.reloggedState.set(entry.id);
    this.clearReloggedTimer();
    this.reloggedTimer = setTimeout(() => {
      this.reloggedTimer = null;
      this.reloggedState.set(null);
    }, RELOGGED_DURATION_MS);
  }

  private buildEntries(): readonly HistoryEntry[] {
    const rows = [...this.weighEntries(), ...this.mealEntries()];
    return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private weighEntries(): readonly HistoryEntry[] {
    return this.weightLog.entries().map((weigh, index) => {
      const date = new Date(weigh.at);
      return {
        id: `vejning-${weigh.id}`,
        kind: 'vejning',
        title: WEIGH_TITLE,
        subtitle: index === 0 ? WEIGH_SUBTITLE_LATEST : WEIGH_SUBTITLE,
        value: `${formatDecimal(weigh.kg)} kg`,
        valueTone: 'default',
        ...this.whenOf(date),
        date,
      } satisfies HistoryEntry;
    });
  }

  private mealEntries(): readonly HistoryEntry[] {
    return this.foodLog.allEntries().map((logged) => {
      const date = new Date(logged.loggedAt);
      const { logId, meal, loggedAt, ...food } = logged;
      return {
        id: `maaltid-${logId}`,
        kind: 'mad',
        title: food.name,
        subtitle: mealLabel(meal),
        value: `${food.kcal} kcal`,
        valueTone: 'default',
        ...this.whenOf(date),
        date,
        food,
        meal,
      } satisfies HistoryEntry;
    });
  }

  /** The day's food totals, when the group shows at least one meal – otherwise `null`. */
  private foodSummaryFor(entries: readonly HistoryEntry[]): string | null {
    const meal = entries.find((entry) => entry.kind === 'mad');
    return meal ? formatFoodSummary(this.foodLog.totalsFor(meal.date)) : null;
  }

  /** `'I dag'` · `'I går'` · the weekday abbreviated, plus `'21. sep'`. */
  private whenOf(date: Date): Pick<HistoryEntry, 'when' | 'whenDate'> {
    const days = daysBetween(date, this.now());
    const when = days <= 0 ? 'I dag' : days === 1 ? 'I går' : formatWeekdayAbbreviated(date);
    return { when, whenDate: formatDayMonth(date) };
  }

  private clearReloggedTimer(): void {
    if (this.reloggedTimer !== null) {
      clearTimeout(this.reloggedTimer);
      this.reloggedTimer = null;
    }
  }
}

function mealLabel(meal: MealId): string {
  return MEALS.find((definition) => definition.id === meal)?.label ?? '';
}

/** `'1.970 kcal · P 120 g · K 210 g · F 60 g'` */
export function formatFoodSummary(totals: Macros): string {
  return [
    `${formatInteger(totals.kcal)} kcal`,
    `P ${formatInteger(totals.protein)} g`,
    `K ${formatInteger(totals.carbs)} g`,
    `F ${formatInteger(totals.fat)} g`,
  ].join(' · ');
}

function groupByDay(
  entries: readonly HistoryEntry[],
): readonly Omit<HistoryGroup, 'foodSummary'>[] {
  const order: string[] = [];
  const byLabel = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const label = `${entry.when} · ${entry.whenDate}`;
    const bucket = byLabel.get(label);
    if (bucket) {
      bucket.push(entry);
    } else {
      byLabel.set(label, [entry]);
      order.push(label);
    }
  }
  return order.map((label) => ({ label, entries: byLabel.get(label) ?? [] }));
}
