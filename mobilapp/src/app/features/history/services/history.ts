import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { MEALS } from '../../../core/constants/meals';
import { GOALS } from '../../../core/constants/nutrition';
import { CursorPage, StoreStatus } from '../../../core/models/api';
import { Macros } from '../../../core/models/food';
import { MealId } from '../../../core/models/meal';
import { UserGoalDto } from '../../../core/models/profile-api';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { toLoggedFood } from '../../../core/services/food-log/food-log-mapping';
import { Translate, injectTranslate } from '../../../core/services/language/translate';
import { GOAL_FROM_API } from '../../../core/services/user-profile/profile-mapping';
import { injectApiUrl, mapApiError, parseApiDateTime } from '../../../core/utils/api';
import {
  daysBetween,
  formatDayMonth,
  formatDecimal,
  formatInteger,
  formatWeekdayAbbreviated,
  toIsoDate,
} from '../../../core/utils/date-format';
import { NOW } from '../../../core/utils/now';
import {
  HistoryEntry,
  HistoryEventDto,
  HistoryFilter,
  HistoryFilterId,
  HistoryGroup,
} from '../models/history';

/** `GET me/history`, relative to `API_BASE_URL` (plan-v2 A7). */
export const HISTORY_ENDPOINT = 'me/history';
/** Events per page (the API's default). */
export const HISTORY_PAGE_SIZE = 50;

const ALL_FILTER: HistoryFilter = {
  id: 'alle',
  labelKey: 'history.filters.all',
  // `AchievementCompleted` is left out: achievements are derived locally (plan-v2 P21).
  types: 'AccountCreated,GoalUpdated,FoodLogged,WeightRecorded',
};

export const HISTORY_FILTERS: readonly HistoryFilter[] = [
  ALL_FILTER,
  { id: 'vejning', labelKey: 'history.filters.weigh', types: 'WeightRecorded' },
  { id: 'mad', labelKey: 'history.filters.food', types: 'FoodLogged' },
  { id: 'maal', labelKey: 'history.filters.goal', types: 'GoalUpdated' },
];

/** The re-log button: `pending` while the API saves, then `logged` / `failed` for a moment. */
export type RelogState = 'pending' | 'logged' | 'failed';

export const RELOG_LABEL_KEY = 'history.entries.relog';
export const RELOGGED_LABEL_KEY = 'history.entries.relogged';
export const RELOG_FAILED_LABEL_KEY = 'history.entries.relogFailed';

const RELOG_LABEL_KEY_BY_STATE: Readonly<Record<RelogState, string>> = {
  pending: RELOG_LABEL_KEY,
  logged: RELOGGED_LABEL_KEY,
  failed: RELOG_FAILED_LABEL_KEY,
};

/** How long "Logget i dag" (or the failure) stays on the button after a relog. */
export const RELOGGED_DURATION_MS = 2600;

const WEIGH_TITLE_KEY = 'history.entries.weighTitle';
const WEIGH_SUBTITLE_KEY = 'history.entries.weighSubtitle';
const WEIGH_SUBTITLE_LATEST_KEY = 'history.entries.weighSubtitleLatest';
const GOAL_TITLE_KEY = 'history.entries.goalTitle';
const ACCOUNT_TITLE_KEY = 'history.entries.accountTitle';

const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/**
 * The history from `GET me/history` (spec 7.0), page by page, grouped by day.
 *
 * The page loads the first page and calls `loadMore()` when the user scrolls near the bottom.
 * The filter is sent as `types`, so switching it starts over. The sign-up's first goal is hidden
 * (see `entries`), so a new account only shows "Konto oprettet".
 *
 * The service is provided by `HistoryPage` (not `providedIn: 'root'`): the loaded pages, the
 * filter and the re-log state belong to the screen and reset when you leave it.
 */
@Injectable()
export class HistoryService {
  private readonly http = inject(HttpClient);
  private readonly url = injectApiUrl();
  private readonly now = inject(NOW);
  private readonly foodLog = inject(FoodLogService);
  private readonly t = injectTranslate();

  private readonly filterState = signal<HistoryFilter>(ALL_FILTER);
  private readonly eventsState = signal<readonly HistoryEventDto[]>([]);
  private readonly nextCursorState = signal<string | null>(null);
  private readonly hasMoreState = signal(true);
  private readonly statusState = signal<StoreStatus>('idle');
  private readonly relogSlot = signal<{ readonly id: string; readonly state: RelogState } | null>(
    null,
  );
  private request: Subscription | null = null;
  private reloggedTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filters = HISTORY_FILTERS;
  readonly filter: Signal<HistoryFilterId> = computed(() => this.filterState().id);
  /** Every loaded event, in the API's order (newest first). */
  readonly events: Signal<readonly HistoryEventDto[]> = this.eventsState.asReadonly();
  readonly nextCursor: Signal<string | null> = this.nextCursorState.asReadonly();
  readonly hasMore: Signal<boolean> = this.hasMoreState.asReadonly();
  /** The latest page request: `error` keeps the loaded pages, and `retry()` asks for the page again. */
  readonly status: Signal<StoreStatus> = this.statusState.asReadonly();

  /**
   * The loaded events as entries, newest first. A `GoalUpdated` with the very timestamp of a loaded
   * `AccountCreated` is the goal the API creates at sign-up, so it is left out (spec 7.0: "Kun
   * registrering → vis kun den"). Under the "Mål" filter `AccountCreated` isn't loaded, and the
   * first goal stays.
   */
  readonly entries: Signal<readonly HistoryEntry[]> = computed(() => {
    const events = this.eventsState();
    const signUps = new Set(
      events.filter((event) => event.type === 'AccountCreated').map((event) => event.occurredAt),
    );
    const latestWeigh = events.find((event) => event.type === 'WeightRecorded');
    return events.flatMap((event) => {
      const isSignUpGoal = event.type === 'GoalUpdated' && signUps.has(event.occurredAt);
      const entry = isSignUpGoal ? null : this.toEntry(event, event === latestWeigh);
      return entry ? [entry] : [];
    });
  });

  readonly groups: Signal<readonly HistoryGroup[]> = computed(() => {
    const groups = groupByDay(this.t, this.entries());
    // ponytail: the last loaded day may continue on the next page, so it gets no summary until
    // that page is in. Load until the day ends if the gap ever matters.
    const unfinished = this.hasMoreState() ? groups.at(-1) : undefined;
    return groups.map((group) => ({
      ...group,
      foodSummary: group === unfinished ? null : this.foodSummaryFor(group.entries),
    }));
  });

  /** Loaded, and nothing to show (possible under a filter). */
  readonly isEmpty: Signal<boolean> = computed(
    () => this.statusState() === 'ready' && this.groups().length === 0,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      this.clearReloggedTimer();
    });
  }

  /**
   * Loads the next page. Does nothing while a page is loading, after the last page, and after a
   * failure – then only `retry()` asks again, so scrolling doesn't hammer a failing API.
   */
  loadMore(): void {
    if (this.statusState() === 'idle' || (this.statusState() === 'ready' && this.hasMoreState())) {
      this.fetchPage();
    }
  }

  /** Asks for the failed page again. */
  retry(): void {
    if (this.statusState() === 'error') {
      this.fetchPage();
    }
  }

  /** Switches the filter and starts over from the first page; a page still on its way is dropped. */
  setFilter(filter: HistoryFilter): void {
    this.request?.unsubscribe();
    this.filterState.set(filter);
    this.eventsState.set([]);
    this.nextCursorState.set(null);
    this.hasMoreState.set(true);
    this.fetchPage();
  }

  relogState(entry: HistoryEntry): RelogState | null {
    const relog = this.relogSlot();
    return relog?.id === entry.id ? relog.state : null;
  }

  relogLabel(entry: HistoryEntry): string {
    const state = this.relogState(entry);
    return this.t(state ? RELOG_LABEL_KEY_BY_STATE[state] : RELOG_LABEL_KEY);
  }

  /**
   * Adds the meal back to today's log (the food log store updates itself; the history isn't
   * reloaded) and shows "Logget i dag" – or that it failed – for 2.6 seconds. Ignored while that
   * meal's relog is on its way, so a double tap logs it once.
   */
  relog(entry: HistoryEntry): void {
    const { food, meal } = entry;
    if (!food || !meal || this.relogState(entry) === 'pending') {
      return;
    }
    this.clearReloggedTimer();
    this.relogSlot.set({ id: entry.id, state: 'pending' });
    this.foodLog.add(food, meal).subscribe({
      next: () => this.showRelogResult(entry.id, 'logged'),
      error: () => this.showRelogResult(entry.id, 'failed'),
    });
  }

  private fetchPage(): void {
    const cursor = this.nextCursorState();
    const query = { types: this.filterState().types, limit: HISTORY_PAGE_SIZE };
    this.statusState.set('loading');
    this.request = this.http
      .get<CursorPage<HistoryEventDto>>(this.url(HISTORY_ENDPOINT), {
        params: cursor === null ? query : { ...query, cursor },
      })
      .pipe(mapApiError())
      .subscribe({
        next: (page) => {
          this.eventsState.update((events) => [...events, ...page.items]);
          this.nextCursorState.set(page.nextCursor);
          this.hasMoreState.set(page.hasMore && page.nextCursor !== null);
          this.statusState.set('ready');
        },
        error: () => this.statusState.set('error'),
      });
  }

  /** The event as a line, or `null` when it isn't shown (or lacks its payload). */
  private toEntry(event: HistoryEventDto, isLatestWeigh: boolean): HistoryEntry | null {
    const date = parseApiDateTime(event.occurredAt);
    const base = { id: `${event.type}-${event.referenceId}`, ...this.whenOf(date), date };
    const { weightLog, foodLog, goal } = event;
    switch (event.type) {
      case 'WeightRecorded':
        return (
          weightLog && {
            ...base,
            kind: 'vejning',
            title: this.t(WEIGH_TITLE_KEY),
            subtitle: this.t(isLatestWeigh ? WEIGH_SUBTITLE_LATEST_KEY : WEIGH_SUBTITLE_KEY),
            value: this.t('history.entries.weighValue', { kg: formatDecimal(weightLog.weight) }),
          }
        );
      case 'FoodLogged': {
        if (!foodLog) {
          return null;
        }
        const { logId, meal, loggedAt, ...food } = toLoggedFood(foodLog);
        return {
          ...base,
          kind: 'mad',
          title: food.name,
          subtitle: mealLabel(this.t, meal),
          value: this.t('history.entries.mealValue', { kcal: food.kcal }),
          food,
          meal,
        };
      }
      case 'GoalUpdated':
        return (
          goal && {
            ...base,
            kind: 'maal',
            title: this.t(GOAL_TITLE_KEY),
            subtitle: goalLabel(this.t, goal),
            value: this.t('history.entries.goalValue', {
              kcal: formatInteger(goal.targetDailyCalories),
            }),
          }
        );
      case 'AccountCreated':
        return {
          ...base,
          kind: 'konto',
          title: this.t(ACCOUNT_TITLE_KEY),
          subtitle: '',
          value: '',
        };
      case 'AchievementCompleted':
        // Never asked for (see `ALL_FILTER`).
        return null;
    }
  }

  /** The day's food totals from the meals' payload, when the group shows at least one meal. */
  private foodSummaryFor(entries: readonly HistoryEntry[]): string | null {
    const foods = entries.flatMap((entry) => (entry.food ? [entry.food] : []));
    if (foods.length === 0) {
      return null;
    }
    const totals = foods.reduce<Macros>(
      (sum, food) => ({
        kcal: sum.kcal + food.kcal,
        protein: sum.protein + food.protein,
        carbs: sum.carbs + food.carbs,
        fat: sum.fat + food.fat,
      }),
      EMPTY_MACROS,
    );
    return formatFoodSummary(this.t, totals);
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

  private showRelogResult(id: string, state: Exclude<RelogState, 'pending'>): void {
    this.relogSlot.set({ id, state });
    this.reloggedTimer = setTimeout(() => {
      this.reloggedTimer = null;
      this.relogSlot.set(null);
    }, RELOGGED_DURATION_MS);
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

function goalLabel(t: Translate, goal: UserGoalDto): string {
  const definition = GOALS.find((candidate) => candidate.id === GOAL_FROM_API[goal.goalType]);
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
