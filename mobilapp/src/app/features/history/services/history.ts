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
  toIsoDate,
} from '../../../core/utils/date-format';
import { NOW } from '../../../core/utils/now';
import { Translate, injectTranslate } from '../../../core/services/language/translate';
import { HistoryEntry, HistoryFilter, HistoryFilterId, HistoryGroup } from '../models/history';

export const HISTORY_FILTERS: readonly HistoryFilter[] = [
  { id: 'alle', labelKey: 'history.filters.all' },
  { id: 'vejning', labelKey: 'history.filters.weigh' },
  { id: 'mad', labelKey: 'history.filters.food' },
  { id: 'maal', labelKey: 'history.filters.goal' },
];

export const RELOG_LABEL_KEY = 'history.entries.relog';
export const RELOGGED_LABEL_KEY = 'history.entries.relogged';

/** How long "Logget i dag" stays on the button after a relog. */
export const RELOGGED_DURATION_MS = 2600;

const WEIGH_TITLE_KEY = 'history.entries.weighTitle';
const WEIGH_SUBTITLE_KEY = 'history.entries.weighSubtitle';
const WEIGH_SUBTITLE_LATEST_KEY = 'history.entries.weighSubtitleLatest';

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
  private readonly t = injectTranslate();

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
    groupByDay(this.t, this.visibleEntries()).map((group) => ({
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
    return this.t(this.isRelogged(entry) ? RELOGGED_LABEL_KEY : RELOG_LABEL_KEY);
  }

  /** Adds the meal back to today's log and shows "Logget i dag" for 2.6 seconds. */
  relog(entry: HistoryEntry): void {
    const { food, meal } = entry;
    if (!food || !meal) {
      return;
    }
    this.foodLog.add(food, meal).subscribe();
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
        title: this.t(WEIGH_TITLE_KEY),
        subtitle: this.t(index === 0 ? WEIGH_SUBTITLE_LATEST_KEY : WEIGH_SUBTITLE_KEY),
        value: this.t('history.entries.weighValue', { kg: formatDecimal(weigh.kg) }),
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
        subtitle: mealLabel(this.t, meal),
        value: this.t('history.entries.mealValue', { kcal: food.kcal }),
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
    return meal ? formatFoodSummary(this.t, this.foodLog.totalsFor(meal.date)) : null;
  }

  /** `'I dag'` · `'I går'` · the weekday abbreviated, plus `'21. sep'`. */
  private whenOf(date: Date): Pick<HistoryEntry, 'when' | 'whenDate'> {
    const days = daysBetween(date, this.now());
    const when =
      days <= 0
        ? this.t('history.entries.today')
        : days === 1
          ? this.t('history.entries.yesterday')
          : formatWeekdayAbbreviated(this.t, date);
    return { when, whenDate: formatDayMonth(this.t, date) };
  }

  private clearReloggedTimer(): void {
    if (this.reloggedTimer !== null) {
      clearTimeout(this.reloggedTimer);
      this.reloggedTimer = null;
    }
  }
}

function mealLabel(t: Translate, meal: MealId): string {
  const definition = MEALS.find((candidate) => candidate.id === meal);
  return definition ? t(definition.labelKey) : '';
}

/** `'1.970 kcal · P 120 g · K 210 g · F 60 g'` */
export function formatFoodSummary(t: Translate, totals: Macros): string {
  return t('history.entries.foodSummary', {
    kcal: formatInteger(totals.kcal),
    protein: formatInteger(totals.protein),
    carbs: formatInteger(totals.carbs),
    fat: formatInteger(totals.fat),
  });
}

/** Groups by calendar day, so the grouping doesn't depend on the language of the label. */
function groupByDay(
  t: Translate,
  entries: readonly HistoryEntry[],
): readonly Omit<HistoryGroup, 'foodSummary'>[] {
  const groups = new Map<string, { id: string; label: string; entries: HistoryEntry[] }>();
  for (const entry of entries) {
    const id = toIsoDate(entry.date);
    const group = groups.get(id);
    if (group) {
      group.entries.push(entry);
    } else {
      const label = t('history.entries.groupLabel', { day: entry.when, date: entry.whenDate });
      groups.set(id, { id, label, entries: [entry] });
    }
  }
  return [...groups.values()];
}
