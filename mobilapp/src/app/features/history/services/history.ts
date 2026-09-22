import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../core/constants/nutrition';
import { FoodLogService } from '../../../core/services/food-log';
import { UserProfileService } from '../../../core/services/user-profile';
import { WeightLogService } from '../../../core/services/weight-log';
import {
  addDays,
  daysBetween,
  formatDayMonth,
  formatDecimal,
  formatInteger,
  formatWeekdayAbbreviated,
  startOfDay,
} from '../../../core/utils/date-format';
import { clamp } from '../../../core/utils/math';
import { NOW } from '../../../core/utils/now';
import { HistoryEntry, HistoryFilter, HistoryFilterId, HistoryGroup } from '../models/history';
import {
  DAY_SUMMARY_TITLE_OVER,
  DAY_SUMMARY_TITLE_UNDER,
  DEMO_DAY_SUMMARIES,
  DEMO_GOAL_CHANGES,
  DEMO_HISTORY_MEALS,
  WEIGH_SUBTITLE,
  WEIGH_SUBTITLE_LATEST,
  WEIGH_TITLE,
} from './history-demo-data';

/** Designets `histFilters`. */
export const HISTORY_FILTERS: readonly HistoryFilter[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'vejning', label: 'Vejning' },
  { id: 'mad', label: 'Mad' },
  { id: 'maal', label: 'Mål' },
];

export const RELOG_LABEL = 'Log igen i dag';
export const RELOGGED_LABEL = 'Logget i dag';

/** Hvor længe "Logget i dag" står på knappen efter et gen-log (designets 2600 ms). */
export const RELOGGED_DURATION_MS = 2600;

/** Designets demo-poster dateres til middag, så tidspunktet ikke flytter dagsgrupperingen. */
const DEMO_HOUR = 12;
const TYPOGRAPHIC_MINUS = '−';

/**
 * Bygger historikkens poster og grupperer dem pr. dag.
 *
 * Kun vejningerne er rigtige data (`WeightLogService`). Måltider, målændringer og
 * dagsopsamlinger er designets demo-indhold fra `history-demo-data.ts` – de er flettet ind i
 * præcis den rækkefølge, prototypen bruger (`historyGroups`), og sorteres derefter faldende
 * efter dato. Sorteringen er stabil, så rækkefølgen inden for en dag følger flettningen.
 *
 * Servicen leveres af `HistoryPage` (ikke `providedIn: 'root'`), fordi både filteret og
 * "Logget i dag"-tilstanden hører til skærmen og skal nulstilles, når man forlader den.
 */
@Injectable()
export class HistoryService {
  private readonly now = inject(NOW);
  private readonly weightLog = inject(WeightLogService);
  private readonly foodLog = inject(FoodLogService);
  private readonly userProfile = inject(UserProfileService);

  private readonly filterState = signal<HistoryFilterId>('alle');
  private readonly reloggedState = signal<string | null>(null);
  private reloggedTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filters = HISTORY_FILTERS;
  readonly filter: Signal<HistoryFilterId> = this.filterState.asReadonly();

  /** Alle poster, nyeste først. */
  readonly entries: Signal<readonly HistoryEntry[]> = computed(() => this.buildEntries());

  readonly visibleEntries: Signal<readonly HistoryEntry[]> = computed(() => {
    const filter = this.filterState();
    return filter === 'alle'
      ? this.entries()
      : this.entries().filter((entry) => entry.kind === filter);
  });

  readonly groups: Signal<readonly HistoryGroup[]> = computed(() =>
    groupByDay(this.visibleEntries()),
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

  /** Lægger måltidet på dagens log igen og viser "Logget i dag" i 2,6 sekunder. */
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

  /** Designets flettning: to poster fra `histAll`, to måltider, én målændring, så resten. */
  private buildEntries(): readonly HistoryEntry[] {
    const interleaved = interleave(this.weighEntries(), this.daySummaryEntries());
    const meals = this.mealEntries();
    const goals = this.goalEntries();
    const rows = [
      ...interleaved.slice(0, 2),
      ...meals.slice(0, 2),
      ...goals.slice(0, 1),
      ...interleaved.slice(2),
      ...meals.slice(2),
      ...goals.slice(1),
    ];
    // Sorteres på dato, ikke tidspunkt: så bevarer den stabile sortering flettningens
    // rækkefølge inden for dagen, præcis som prototypen (hvor alt lå kl. 12).
    return [...rows].sort((a, b) => startOfDay(b.date).getTime() - startOfDay(a.date).getTime());
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

  private daySummaryEntries(): readonly HistoryEntry[] {
    const target = this.userProfile.kcalTarget();
    return DEMO_DAY_SUMMARIES.map(({ daysAgo, deltaKcal }) => {
      const date = this.demoDate(daysAgo);
      const over = deltaKcal > 0;
      return {
        id: `dagsmaal-${daysAgo}`,
        kind: 'mad',
        title: over ? DAY_SUMMARY_TITLE_OVER : DAY_SUMMARY_TITLE_UNDER,
        subtitle: `${formatInteger(target + deltaKcal)} af ${formatInteger(target)} kcal`,
        value: `${signOf(deltaKcal)}${Math.abs(deltaKcal)} kcal`,
        valueTone: over ? 'negative' : 'positive',
        ...this.whenOf(date),
        date,
      } satisfies HistoryEntry;
    });
  }

  private mealEntries(): readonly HistoryEntry[] {
    return DEMO_HISTORY_MEALS.map(({ daysAgo, meal, subtitle, food }) => {
      const date = this.demoDate(daysAgo);
      return {
        id: `maaltid-${food.id}`,
        kind: 'mad',
        title: food.name,
        subtitle,
        value: `${food.kcal} kcal`,
        valueTone: 'default',
        ...this.whenOf(date),
        date,
        food,
        meal,
      } satisfies HistoryEntry;
    });
  }

  private goalEntries(): readonly HistoryEntry[] {
    const profile = this.userProfile.profile();
    const target = this.userProfile.kcalTarget();
    const pace = this.userProfile.paceDefinition();
    const { KCAL_TARGET, GOAL_WEIGHT, HEIGHT, PACE } = DEMO_GOAL_CHANGES;
    // Designets `gw`: "holde vægten" sigter mod den nuværende vægt, resten mod den
    // afgrænsede målvægt – samme regel som vægtskærmen bruger.
    const goalWeight = Math.round(
      profile.goal === 'hold'
        ? profile.weightKg
        : clamp(profile.goalWeightKg, WEIGHT_MIN_KG, WEIGHT_MAX_KG),
    );
    const height = profile.heightCm;

    return [
      this.goalEntry(
        'kaloriemaal',
        KCAL_TARGET.daysAgo,
        KCAL_TARGET.title,
        `${formatInteger(target - KCAL_TARGET.deltaKcal)} → ${formatInteger(target)} kcal`,
        `+${KCAL_TARGET.deltaKcal} kcal`,
      ),
      this.goalEntry(
        'maalvaegt',
        GOAL_WEIGHT.daysAgo,
        GOAL_WEIGHT.title,
        `${goalWeight + GOAL_WEIGHT.deltaKg} → ${goalWeight} kg`,
        `${TYPOGRAPHIC_MINUS}${GOAL_WEIGHT.deltaKg} kg`,
      ),
      this.goalEntry(
        'hoejde',
        HEIGHT.daysAgo,
        HEIGHT.title,
        `${height - HEIGHT.deltaCm} → ${height} cm`,
        `${height} cm`,
      ),
      this.goalEntry(
        'tempo',
        PACE.daysAgo,
        PACE.title,
        `${PACE.fromLabel} → ${pace ? pace.label.toLowerCase() : PACE.fallbackLabel}`,
        pace ? pace.rateLabel : PACE.fallbackRateLabel,
      ),
    ];
  }

  private goalEntry(
    key: string,
    daysAgo: number,
    title: string,
    subtitle: string,
    value: string,
  ): HistoryEntry {
    const date = this.demoDate(daysAgo);
    return {
      id: `maal-${key}`,
      kind: 'maal',
      title,
      subtitle,
      value,
      valueTone: 'default',
      ...this.whenOf(date),
      date,
    };
  }

  /** Designets `whenOf`: `'I dag'` · `'I går'` · ugedagen forkortet, plus `'21. sep'`. */
  private whenOf(date: Date): Pick<HistoryEntry, 'when' | 'whenDate'> {
    const days = daysBetween(date, this.now());
    const when = days <= 0 ? 'I dag' : days === 1 ? 'I går' : formatWeekdayAbbreviated(date);
    return { when, whenDate: formatDayMonth(date) };
  }

  /** Designets `agoDate`: samme klokkeslæt (middag) `daysAgo` dage tilbage. */
  private demoDate(daysAgo: number): Date {
    const noonToday = startOfDay(this.now());
    noonToday.setHours(DEMO_HOUR);
    return addDays(noonToday, -daysAgo);
  }

  private clearReloggedTimer(): void {
    if (this.reloggedTimer !== null) {
      clearTimeout(this.reloggedTimer);
      this.reloggedTimer = null;
    }
  }
}

/** Designets `histAll`: vejning, dagsopsamling, vejning, dagsopsamling … */
function interleave(
  weighs: readonly HistoryEntry[],
  summaries: readonly HistoryEntry[],
): readonly HistoryEntry[] {
  const merged: HistoryEntry[] = [];
  const length = Math.max(weighs.length, summaries.length);
  for (let index = 0; index < length; index++) {
    const weigh = weighs[index];
    if (weigh) {
      merged.push(weigh);
    }
    const summary = summaries[index];
    if (summary) {
      merged.push(summary);
    }
  }
  return merged;
}

function groupByDay(entries: readonly HistoryEntry[]): readonly HistoryGroup[] {
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

function signOf(value: number): string {
  return value > 0 ? '+' : TYPOGRAPHIC_MINUS;
}
