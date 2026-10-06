import { Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { APP_PATH, QUERY_PARAM } from '../../../core/constants/app-route';
import { MEALS } from '../../../core/constants/meals';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../core/constants/nutrition';
import { DailyFoodTotals, Macros } from '../../../core/models/food';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator/nutrition-calculator';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { WeightLogService } from '../../../core/services/weight-log/weight-log';
import {
  DAY_NAME_LONG_KEYS,
  DAY_NAME_SHORT_KEYS,
  addDays,
  formatDayLabel,
  formatDayMonth,
  formatDecimal,
  formatGrams,
  formatInteger,
  formatWeekdayAbbreviated,
  formatWeightKg,
  fromIsoDate,
  isSameDay,
  mondayIndex,
} from '../../../core/utils/date-format';
import { clamp } from '../../../core/utils/math';
import { Translate, injectTranslate } from '../../../core/services/language/translate';
import { ProgressBarTone } from '../../../shared/components/ui-progress-bar/ui-progress-bar';

/** Today's position in the rolling week: the rings run from today − 6 to today. */
export const TODAY_INDEX = 6;
/** Days in the "Åbn mere" sheet, today included – rolling like the week (spec 5.4, P15). */
export const HOME_HISTORY_DAYS = 30;

/** The ring's color: green for a closed ring, orange in progress, empty for days without data. */
export type RingTone = 'positive' | 'accent' | 'none';

export interface WeekRing {
  readonly index: number;
  readonly label: string;
  readonly dashOffset: number;
  readonly tone: RingTone;
  /** Pre-built BEM modifier for the ring's stroke, so the template doesn't need to assemble the class name. */
  readonly toneClass: string;
  readonly isToday: boolean;
  readonly isSelected: boolean;
}

export interface DayMacro {
  readonly label: string;
  /** Share of the daily goal, 0..1. */
  readonly value: number;
  readonly tone: ProgressBarTone;
  readonly text: string;
}

export interface DaySummary {
  readonly title: string;
  /** Share of the calorie goal, 0..1. */
  readonly progress: number;
  readonly progressTone: ProgressBarTone;
  readonly kcalEatenText: string;
  readonly kcalTargetText: string;
  readonly weightText: string;
  readonly macros: readonly DayMacro[];
}

export interface WeekSummary {
  readonly hitText: string;
  readonly averageKcalText: string;
  readonly proteinHitText: string;
  readonly streakText: string;
  readonly note: string;
}

/** One day in the "Åbn mere" sheet. */
export interface HomeDayRow {
  /** Local date `YYYY-MM-DD`. */
  readonly id: string;
  /** `'Tor. 24. sep'`. */
  readonly label: string;
  /** `'1.850 / 2.100 kcal'`, or `–` for a day without entries. */
  readonly kcalText: string;
  /** `'P 120 g · K 200 g · F 60 g'`, or empty for a day without entries. */
  readonly macroText: string;
}

export interface GoalSummary {
  readonly toGoalText: string;
  readonly goalWeightText: string;
  /** Share of the way to the goal weight, 0.04..1 as in the design. */
  readonly progress: number;
  readonly coach: string;
}

export interface HomeTodo {
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly queryParams: Record<string, string> | null;
}

const NO_VALUE = '–';
/** The week card until the food log and the goal have loaded – no false "0 days". */
const NO_WEEK: WeekSummary = {
  hitText: NO_VALUE,
  averageKcalText: NO_VALUE,
  proteinHitText: NO_VALUE,
  streakText: NO_VALUE,
  note: '',
};
const GREETING_KEY = 'home.summary.greeting';
/** The greeting when a name follows – its own message so a translation can place the comma. */
const GREETING_BEFORE_NAME_KEY = 'home.summary.greetingBeforeName';
/** `'{{weekday}} {{dayMonth}}'` – the core date label, here with the abbreviated weekday. */
const DAY_LABEL_KEY = 'core.date.dayLabel';

/** The circumference of the day ring (r = 16 in a 40×40 viewBox). */
const RING_CIRCUMFERENCE = 100.5;
const RING_FULL_THRESHOLD = 0.98;
/** BEM block for the day ring's stroke in `HomeWeekRings` — used to build the tone modifier. */
const RING_PROGRESS_BLOCK = 'home-week-rings__progress';

const WEEK_HIT_THRESHOLD = 0.95;
const SOLID_WEEK_MIN_HITS = 2;

const GOAL_REACHED_MARGIN_KG = 0.05;
const MIN_GOAL_PROGRESS = 0.04;
const DEFAULT_PACE_RATE_LABEL_KEY = 'home.summary.defaultPaceRate';
const DEFAULT_PACE_KG_PER_WEEK = 0.5;

interface MacroDefinition {
  readonly labelKey: string;
  readonly key: keyof Omit<Macros, 'kcal'>;
  readonly tone: ProgressBarTone;
}

const MACRO_DEFINITIONS: readonly MacroDefinition[] = [
  { labelKey: 'home.summary.macros.protein', key: 'protein', tone: 'accent' },
  { labelKey: 'home.summary.macros.carbs', key: 'carbs', tone: 'selected' },
  { labelKey: 'home.summary.macros.fat', key: 'fat', tone: 'secondary' },
];

/**
 * Gathers the Home screen's numbers in one place: the rolling week's rings (today − 6 … today),
 * the selected day's card, the week's key figures, the last 30 days for the "Åbn mere" sheet, the
 * next step, and the goal card.
 *
 * Every day comes from the food log the API delivered (`FoodLogService.dailyTotals`). Days
 * without a single logged entry are `null` all the way through and are shown as empty rings and
 * `–`, so the screen never claims a day had no food. Only today shows 0 – once the food log has
 * loaded (spec 5.2). The anchor is `FoodLogService.today`, so the week moves on at midnight.
 *
 * The service is `providedIn: 'root'` so the selected day and the celebration's baseline survive
 * a tab switch (it destroys `HomePage`). The celebration toast's timers belong to the page and
 * therefore live in `HomePage`.
 */
@Injectable({ providedIn: 'root' })
export class HomeSummaryService {
  private readonly profileService = inject(UserProfileService);
  private readonly foodLog = inject(FoodLogService);
  private readonly weightLog = inject(WeightLogService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly t = injectTranslate();
  /** The API stores Home reads – "Prøv igen" reloads the ones that failed. */
  private readonly stores = [this.foodLog, this.weightLog, this.profileService];

  /** `null` = follow today, matching the design's `s.selDay ?? todayIdx`. */
  private readonly selected = signal<number | null>(null);
  /** Today's local midnight. */
  private readonly today = computed(() => fromIsoDate(this.foodLog.today()));

  /** Index in the rolling week, 0 = six days ago … `TODAY_INDEX` = today. */
  readonly selectedDay = computed(() => this.selected() ?? TODAY_INDEX);

  /** Food log and profile have loaded – before that, Home has no baseline to celebrate from. */
  readonly ready = computed(
    () => this.foodLog.status() === 'ready' && this.profileService.status() === 'ready',
  );
  /**
   * A store failed to load: Home shows a message and "Prøv igen". The profile counts too,
   * otherwise a failed load would show a silent 0 kcal goal (spec 5.3).
   */
  readonly loadFailed = computed(() => this.stores.some((store) => store.status() === 'error'));

  private readonly kcalTarget = computed(() => this.profileService.targets().kcal);
  readonly todayLabel = computed(() => formatDayLabel(this.t, this.today()));

  /** The rolling week's days, oldest first – today is `TODAY_INDEX`. */
  private readonly weekDays = computed<readonly DailyFoodTotals[]>(() =>
    this.foodLog.dailyTotals(addDays(this.today(), -TODAY_INDEX), this.today()),
  );

  /** The logged totals per day of the week; `null` = no entry that day. */
  private readonly dayTotals = computed<readonly (Macros | null)[]>(() =>
    this.weekDays().map((day) => (day.entryCount === 0 ? null : day.totals)),
  );

  /** Share of the daily calorie goal per day; `null` where `dayTotals` has no data. */
  private readonly dayParts = computed<readonly (number | null)[]>(() => {
    const target = this.kcalTarget();
    return this.dayTotals().map((totals) =>
      totals === null ? null : shareOf(totals.kcal, target),
    );
  });

  /** True as soon as today's calories reach the goal. */
  readonly goalReached = computed(() => (this.dayParts()[TODAY_INDEX] ?? 0) >= 1);

  private readonly celebrationPending = signal(false);
  /**
   * Today's goal was reached after the data loaded, and `HomePage` hasn't celebrated it yet
   * (`markCelebrated()`). Tracked here, because food is logged on another tab while Home is gone.
   */
  readonly celebrationDue: Signal<boolean> = this.celebrationPending.asReadonly();

  /** False until the app knows the user's name – until then Home just greets with `'Hej'`. */
  readonly hasName = computed(() => this.profileService.displayName() !== '');
  /** "Hej," when a name follows, so the comma sits right after the word and not before the name. */
  readonly greeting = computed(() =>
    this.t(this.hasName() ? GREETING_BEFORE_NAME_KEY : GREETING_KEY),
  );

  readonly weekRings = computed<readonly WeekRing[]>(() => {
    const selected = this.selectedDay();
    return this.dayParts().map((part, index) => {
      // 0 is empty too: a round-capped stroke with no length would still draw a dot.
      const tone: RingTone = !part ? 'none' : part >= RING_FULL_THRESHOLD ? 'positive' : 'accent';
      return {
        index,
        label: this.dayName(DAY_NAME_SHORT_KEYS[mondayIndex(this.dayAt(index))]),
        dashOffset: RING_CIRCUMFERENCE * (1 - (part ?? 0)),
        tone,
        toneClass: `${RING_PROGRESS_BLOCK}--${tone}`,
        isToday: index === TODAY_INDEX,
        isSelected: index === selected,
      };
    });
  });

  readonly daySummary = computed<DaySummary>(() => {
    const selected = this.selectedDay();
    const totals = this.shownTotals(selected);
    const part = totals === null ? null : shareOf(totals.kcal, this.kcalTarget());
    const weightKg = this.weightForDay(selected);
    const dayName = this.dayName(DAY_NAME_LONG_KEYS[mondayIndex(this.dayAt(selected))]);
    return {
      title: dayTitle(this.t, dayName, selected, TODAY_INDEX),
      progress: part ?? 0,
      progressTone: part === null ? 'muted' : part >= RING_FULL_THRESHOLD ? 'positive' : 'accent',
      kcalEatenText: totals === null ? NO_VALUE : formatWhole(totals.kcal),
      kcalTargetText: this.goalText(this.kcalTarget()),
      weightText: weightKg === null ? NO_VALUE : formatDecimal(weightKg),
      macros: this.macrosFor(totals),
    };
  });

  private readonly proteinGoalPerDay = computed(() => this.profileService.targets().protein);

  /** Only days with data count. Without data the average is `null`, not zero. */
  private readonly weekStats = computed(() => {
    const parts = this.dayParts();
    const logged = parts.filter((part): part is number => part !== null);
    const loggedTotals = this.dayTotals().filter((totals): totals is Macros => totals !== null);
    const proteinGoal = this.proteinGoalPerDay();

    const hit = logged.filter((part) => part >= WEEK_HIT_THRESHOLD).length;
    // The real intake – `parts` stop at the goal.
    const averageKcal =
      loggedTotals.length === 0
        ? null
        : Math.round(
            loggedTotals.reduce((total, { kcal }) => total + kcal, 0) / loggedTotals.length,
          );
    const proteinHit = loggedTotals.filter(
      (totals) => proteinGoal > 0 && totals.protein >= proteinGoal * WEEK_HIT_THRESHOLD,
    ).length;

    let streak = 0;
    for (let index = TODAY_INDEX; index >= 0; index--) {
      const part = parts[index];
      if (part === null || part === undefined || part < WEEK_HIT_THRESHOLD) {
        break;
      }
      streak++;
    }

    return { loggedDays: logged.length, hit, averageKcal, proteinHit, streakDays: streak };
  });

  readonly weekSummary = computed<WeekSummary>(() => {
    if (this.foodLog.status() !== 'ready' || this.profileService.goal() === null) {
      return NO_WEEK;
    }
    const { loggedDays, hit, averageKcal, proteinHit, streakDays } = this.weekStats();
    return {
      hitText: String(hit),
      averageKcalText: averageKcal === null ? NO_VALUE : formatInteger(averageKcal),
      proteinHitText: String(proteinHit),
      streakText:
        streakDays === 1
          ? this.t('home.summary.streakOne')
          : this.t('home.summary.streak', { streakDays }),
      note: this.t(weekNoteKey(hit, loggedDays)),
    };
  });

  /** "Åbn mere": the last `HOME_HISTORY_DAYS` days, newest first (spec 5.4/5.5). */
  readonly dayRows = computed<readonly HomeDayRow[]>(() => {
    const goal = this.goalText(this.kcalTarget());
    return this.foodLog
      .dailyTotals(addDays(this.today(), 1 - HOME_HISTORY_DAYS), this.today())
      .map(({ date, totals, entryCount }): HomeDayRow => {
        const day = fromIsoDate(date);
        const logged = entryCount > 0;
        return {
          id: date,
          label: this.t(DAY_LABEL_KEY, {
            weekday: formatWeekdayAbbreviated(this.t, day),
            dayMonth: formatDayMonth(this.t, day),
          }),
          kcalText: logged
            ? this.t('home.monthSheet.kcal', { eaten: formatWhole(totals.kcal), goal })
            : NO_VALUE,
          macroText: logged
            ? this.t('home.monthSheet.macros', {
                protein: formatWhole(totals.protein),
                carbs: formatWhole(totals.carbs),
                fat: formatWhole(totals.fat),
              })
            : '',
        };
      })
      .reverse();
  });

  /** Only from loaded stores – a step the user may already have done is never guessed. */
  readonly todos = computed<readonly HomeTodo[]>(() => {
    const todos: HomeTodo[] = [];
    const latest = this.weightLog.latest();
    // Against Home's day, not `weighedToday`: that one doesn't move on at midnight.
    const weighedToday = latest !== null && isSameDay(new Date(latest.at), this.today());
    if (this.weightLog.status() === 'ready' && !weighedToday) {
      todos.push({
        title: this.t('home.summary.todos.weighTitle'),
        subtitle: this.t('home.summary.todos.weighSubtitle'),
        path: APP_PATH.WEIGHT,
        queryParams: null,
      });
    }
    const byMeal = this.foodLog.byMeal();
    for (const meal of MEALS) {
      if (this.foodLog.status() === 'ready' && (byMeal.get(meal.id) ?? []).length === 0) {
        todos.push({
          title: this.t('home.summary.todos.mealTitle', {
            meal: this.t(meal.labelKey).toLowerCase(),
          }),
          subtitle: this.t('home.summary.todos.mealSubtitle'),
          path: APP_PATH.FOOD,
          queryParams: { [QUERY_PARAM.ADD_MEAL]: meal.id },
        });
      }
    }
    return todos;
  });

  readonly nextTodo = computed<HomeTodo | null>(() => this.todos()[0] ?? null);
  readonly todoCountLabel = computed(() => {
    const count = this.todos().length;
    return count > 1 ? `1 / ${count}` : this.t('home.summary.todoCountSingle');
  });

  /** The goal card waits for the API's goal and is hidden when the goal is to maintain weight. */
  readonly showGoalCard = computed(
    () => this.profileService.goal() !== null && this.profileService.profile().goal !== 'hold',
  );

  readonly goalSummary = computed<GoalSummary>(() => {
    const { goal, weightKg, goalWeightKg } = this.profileService.profile();
    const target = clamp(goalWeightKg, WEIGHT_MIN_KG, WEIGHT_MAX_KG);
    const entries = this.weightLog.entries();
    const startKg = entries.at(-1)?.kg ?? weightKg;
    const totalDistance = Math.abs(target - startKg) || 1;
    const left = Math.abs(target - weightKg);
    const pace = this.calculator.paceFor(this.profileService.profile().pace);
    const reached = left < GOAL_REACHED_MARGIN_KG;
    const weeks = Math.max(1, Math.ceil(left / (pace?.kgPerWeek ?? DEFAULT_PACE_KG_PER_WEEK)));

    return {
      toGoalText: reached
        ? this.t('home.summary.goal.reached')
        : this.t('home.summary.goal.toGoal', { kg: formatDecimal(left) }),
      goalWeightText: formatWeightKg(target),
      progress: clamp(1 - left / totalDistance, MIN_GOAL_PROGRESS, 1),
      coach: reached
        ? this.t('home.summary.goal.coachReached')
        : goal === 'hold'
          ? this.t('home.summary.goal.coachHold', { kg: formatDecimal(left) })
          : this.t(weeks === 1 ? 'home.summary.goal.coachPaceOne' : 'home.summary.goal.coachPace', {
              pace: this.t(pace ? pace.rateLabelKey : DEFAULT_PACE_RATE_LABEL_KEY),
              weeks,
            }),
    };
  });

  constructor() {
    // `null` while the data loads (also after a sign-out): the first ready value is the baseline,
    // so a goal already reached on load isn't celebrated; a goal no longer reached drops it.
    let previous: boolean | null = null;
    effect(() => {
      const reached = this.ready() ? this.goalReached() : null;
      if (reached !== true) {
        this.celebrationPending.set(false);
      } else if (previous === false) {
        this.celebrationPending.set(true);
      }
      previous = reached;
    });
  }

  selectDay(index: number): void {
    this.selected.set(index);
  }

  /** `HomePage` has shown the celebration. */
  markCelebrated(): void {
    this.celebrationPending.set(false);
  }

  /** Reloads the stores that failed. `load()` never errors and completes, so nothing hangs. */
  reload(): void {
    for (const store of this.stores) {
      if (store.status() === 'error') {
        store.load().subscribe();
      }
    }
  }

  /** A goal as a whole number – `–` until the API's goal has loaded, never a silent 0 (5.3). */
  private goalText(value: number): string {
    return this.profileService.goal() === null ? NO_VALUE : formatWhole(value);
  }

  private dayName(key: string | undefined): string {
    return key ? this.t(key) : '';
  }

  /** The date of a day in the rolling week. */
  private dayAt(index: number): Date {
    return addDays(this.today(), index - TODAY_INDEX);
  }

  /** The day card's totals: as `dayTotals`, but today is 0 once the food log has loaded (5.2). */
  private shownTotals(index: number): Macros | null {
    const loadedToday = index === TODAY_INDEX && this.foodLog.status() === 'ready';
    return loadedToday
      ? (this.weekDays()[index]?.totals ?? null)
      : (this.dayTotals()[index] ?? null);
  }

  /** The weigh-in from that day, or `null` if the user didn't weigh in that day. */
  private weightForDay(index: number): number | null {
    const day = this.dayAt(index);
    const entry = this.weightLog
      .entries()
      .find((candidate) => isSameDay(new Date(candidate.at), day));
    return entry?.kg ?? null;
  }

  /** Macros follow the same rule as calories: a day without data shows `–`, not 0. */
  private macrosFor(logged: Macros | null): readonly DayMacro[] {
    const goals = this.profileService.targets();
    return MACRO_DEFINITIONS.map((macro) => {
      const goal = goals[macro.key];
      const hasData = logged !== null;
      const value = logged?.[macro.key] ?? 0;
      return {
        label: this.t(macro.labelKey),
        value: shareOf(value, goal),
        tone: macro.tone,
        text: this.t('home.summary.macroText', {
          eaten: hasData ? formatGrams(value) : NO_VALUE,
          goal: this.goalText(goal),
        }),
      };
    });
  }
}

/** `'Mandag · i dag'` / `'Søndag · i går'` / `'Fredag'` matching the design's `dayTitle`. */
function dayTitle(t: Translate, dayName: string, selected: number, today: number): string {
  if (selected === today) {
    return t('home.summary.dayTitle.today', { dayName });
  }
  return selected === today - 1 ? t('home.summary.dayTitle.yesterday', { dayName }) : dayName;
}

/** Share of `goal`, 0..1 – 0 while there is no goal. */
function shareOf(value: number, goal: number): number {
  return goal > 0 ? Math.min(1, value / goal) : 0;
}

/** Whole kcal or grams with a thousands separator: `1850.4` → `'1.850'`. */
function formatWhole(value: number): string {
  return formatInteger(Math.round(value));
}

function weekNoteKey(hit: number, loggedDays: number): string {
  if (loggedDays === 0) {
    return 'home.summary.weekNote.empty';
  }
  if (hit >= loggedDays) {
    return 'home.summary.weekNote.strong';
  }
  return hit >= SOLID_WEEK_MIN_HITS
    ? 'home.summary.weekNote.solid'
    : 'home.summary.weekNote.uneven';
}
