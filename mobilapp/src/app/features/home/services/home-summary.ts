import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { APP_PATH, QUERY_PARAM } from '../../../core/constants/app-route';
import { MEALS } from '../../../core/constants/meals';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../core/constants/nutrition';
import { Macros } from '../../../core/models/food';
import { ProfilePhoto } from '../../../core/models/profile';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator/nutrition-calculator';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { WeightLogService } from '../../../core/services/weight-log/weight-log';
import {
  DAY_NAME_LONG_KEYS,
  DAY_NAME_SHORT_KEYS,
  addDays,
  formatDayLabel,
  formatDecimal,
  formatGrams,
  formatInteger,
  formatWeightKg,
  isSameDay,
  mondayIndex,
  startOfDay,
} from '../../../core/utils/date-format';
import { clamp } from '../../../core/utils/math';
import { NOW } from '../../../core/utils/now';
import { Translate, injectTranslate } from '../../../core/services/language/translate';
import { ProgressBarTone } from '../../../shared/components/ui-progress-bar/ui-progress-bar';

/** The ring's color: green for a closed ring, orange in progress, empty for days not yet reached. */
export type RingTone = 'positive' | 'accent' | 'none';

export interface WeekRing {
  readonly index: number;
  readonly label: string;
  readonly dashOffset: number;
  readonly tone: RingTone;
  /** Pre-built BEM modifier for the ring's stroke, so the template doesn't need to assemble the class name. */
  readonly toneClass: string;
  readonly isToday: boolean;
  readonly isFuture: boolean;
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
  readonly progressLabel: string;
  readonly hitText: string;
  readonly averageKcalText: string;
  readonly proteinHitText: string;
  readonly streakText: string;
  readonly note: string;
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
const GREETING_KEY = 'home.summary.greeting';
/** The greeting when a name follows – its own message so a translation can place the comma. */
const GREETING_BEFORE_NAME_KEY = 'home.summary.greetingBeforeName';

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
 * Gathers the Home screen's numbers in one place: the week's rings, the selected day's
 * card, the week's key figures, the next step, and the goal card.
 *
 * Past days come from the food log's history (`FoodLogService.dailyTotals`). Days without
 * a single logged entry – and days not yet reached – are `null` all the way through and are
 * shown as empty rings and `–`, so the screen never claims a day had no food.
 *
 * The service is `providedIn: 'root'` so the selected day survives a tab switch. The
 * celebration toast's timers belong to the page and therefore live in `HomePage`.
 */
@Injectable({ providedIn: 'root' })
export class HomeSummaryService {
  private readonly profileService = inject(UserProfileService);
  private readonly foodLog = inject(FoodLogService);
  private readonly weightLog = inject(WeightLogService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);
  private readonly t = injectTranslate();

  /** `null` = follow today, matching the design's `s.selDay ?? todayIdx`. */
  private readonly selected = signal<number | null>(null);

  /** 0 = Monday … 6 = Sunday. */
  readonly todayIndex = computed(() => mondayIndex(this.now()));
  readonly selectedDay = computed(() => this.selected() ?? this.todayIndex());

  readonly displayName = this.profileService.displayName;
  readonly initial = this.profileService.initial;
  readonly kcalTarget = computed(() => this.profileService.targets().kcal);
  readonly todayLabel = computed(() => formatDayLabel(this.t, this.now()));
  readonly weekProgressLabel = computed(() =>
    this.t('home.summary.weekProgress', { dayNumber: this.todayIndex() + 1 }),
  );

  /** The profile photo for the header avatar; `null` shows the initial instead. */
  readonly photo: Signal<ProfilePhoto | null> = computed(() => this.profileService.profile().photo);

  /**
   * The logged totals per weekday (Monday … Sunday). `null` = no data for that day – days
   * without a logged entry and days that haven't come yet.
   */
  private readonly dayTotals = computed<readonly (Macros | null)[]>(() => {
    const today = this.todayIndex();
    const monday = addDays(startOfDay(this.now()), -today);
    return this.foodLog
      .dailyTotals(monday, addDays(monday, DAY_NAME_SHORT_KEYS.length - 1))
      .map((day, index) => (index > today || day.entryCount === 0 ? null : day.totals));
  });

  /** Share of the daily calorie goal per weekday; `null` where `dayTotals` has no data. */
  private readonly dayParts = computed<readonly (number | null)[]>(() => {
    const target = this.kcalTarget();
    return this.dayTotals().map((totals) => {
      if (totals === null) {
        return null;
      }
      return target > 0 ? Math.min(1, totals.kcal / target) : 0;
    });
  });

  /** True as soon as today's calories reach the goal – triggers the celebration toast. */
  readonly goalReached = computed(() => (this.dayParts()[this.todayIndex()] ?? 0) >= 1);

  /** False until the app knows the user's name – until then Home just greets with `'Hej'`. */
  readonly hasName = computed(() => this.displayName() !== '');
  /** "Hej," when a name follows, so the comma sits right after the word and not before the name. */
  readonly greeting = computed(() =>
    this.t(this.hasName() ? GREETING_BEFORE_NAME_KEY : GREETING_KEY),
  );

  readonly weekRings = computed<readonly WeekRing[]>(() => {
    const today = this.todayIndex();
    const selected = this.selectedDay();
    return this.dayParts().map((part, index) => {
      const tone: RingTone =
        part === null ? 'none' : part >= RING_FULL_THRESHOLD ? 'positive' : 'accent';
      return {
        index,
        label: this.dayName(DAY_NAME_SHORT_KEYS[index]),
        dashOffset: RING_CIRCUMFERENCE * (1 - (part ?? 0)),
        tone,
        toneClass: `${RING_PROGRESS_BLOCK}--${tone}`,
        isToday: index === today,
        isFuture: index > today,
        isSelected: index === selected,
      };
    });
  });

  readonly daySummary = computed<DaySummary>(() => {
    const today = this.todayIndex();
    const selected = this.selectedDay();
    const part = this.dayParts()[selected] ?? null;
    const weightKg = this.weightForDay(selected);
    return {
      title: dayTitle(this.t, this.dayName(DAY_NAME_LONG_KEYS[selected]), selected, today),
      progress: part ?? 0,
      progressTone: part === null ? 'muted' : part >= RING_FULL_THRESHOLD ? 'positive' : 'accent',
      kcalEatenText: String(this.dayTotals()[selected]?.kcal ?? NO_VALUE),
      kcalTargetText: String(this.kcalTarget()),
      weightText: weightKg === null ? NO_VALUE : formatDecimal(weightKg),
      macros: this.macrosForDay(selected),
    };
  });

  private readonly proteinGoalPerDay = computed(() => this.profileService.targets().protein);

  /** Only days with data count. Without data the average is `null`, not zero. */
  private readonly weekStats = computed(() => {
    const today = this.todayIndex();
    const elapsed = this.dayParts().slice(0, today + 1);
    const logged = elapsed.filter((part): part is number => part !== null);
    const target = this.kcalTarget();
    const proteinGoal = this.proteinGoalPerDay();

    const hit = logged.filter((part) => part >= WEEK_HIT_THRESHOLD).length;
    const averageKcal =
      logged.length === 0
        ? null
        : Math.round(logged.reduce((total, part) => total + part * target, 0) / logged.length);
    const proteinHit = this.dayTotals()
      .slice(0, today + 1)
      .filter(
        (totals) => totals !== null && totals.protein >= proteinGoal * WEEK_HIT_THRESHOLD,
      ).length;

    let streak = 0;
    for (let index = today; index >= 0; index--) {
      const part = elapsed[index];
      if (part === null || part === undefined || part < WEEK_HIT_THRESHOLD) {
        break;
      }
      streak++;
    }

    return { loggedDays: logged.length, hit, averageKcal, proteinHit, streakDays: streak };
  });

  readonly weekSummary = computed<WeekSummary>(() => {
    const { loggedDays, hit, averageKcal, proteinHit, streakDays } = this.weekStats();
    return {
      progressLabel: this.weekProgressLabel(),
      hitText: String(hit),
      averageKcalText: averageKcal === null ? NO_VALUE : formatInteger(averageKcal),
      proteinHitText: String(proteinHit),
      streakText: this.t('home.summary.streak', { streakDays }),
      note: this.t(weekNoteKey(hit, loggedDays)),
    };
  });

  readonly todos = computed<readonly HomeTodo[]>(() => {
    const todos: HomeTodo[] = [];
    if (!this.weightLog.weighedToday()) {
      todos.push({
        title: this.t('home.summary.todos.weighTitle'),
        subtitle: this.t('home.summary.todos.weighSubtitle'),
        path: APP_PATH.WEIGHT,
        queryParams: null,
      });
    }
    const byMeal = this.foodLog.byMeal();
    for (const meal of MEALS) {
      if ((byMeal.get(meal.id) ?? []).length === 0) {
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

  /** The goal card is hidden when the goal is to maintain weight. */
  readonly showGoalCard = computed(() => this.profileService.profile().goal !== 'hold');

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
          : this.t('home.summary.goal.coachPace', {
              pace: this.t(pace ? pace.rateLabelKey : DEFAULT_PACE_RATE_LABEL_KEY),
              weeks,
            }),
    };
  });

  selectDay(index: number): void {
    this.selected.set(index);
  }

  private dayName(key: string | undefined): string {
    return key ? this.t(key) : '';
  }

  /** The weigh-in from that weekday, or `null` if the user didn't weigh in that day. */
  private weightForDay(index: number): number | null {
    const day = addDays(startOfDay(this.now()), index - this.todayIndex());
    const entry = this.weightLog
      .entries()
      .find((candidate) => isSameDay(new Date(candidate.at), day));
    return entry?.kg ?? null;
  }

  /** Macros follow the same rule as calories: a day without data shows `–`, not 0. */
  private macrosForDay(index: number): readonly DayMacro[] {
    const goals = this.profileService.targets();
    const logged = this.dayTotals()[index] ?? null;
    return MACRO_DEFINITIONS.map((macro) => {
      const goal = goals[macro.key];
      const hasData = logged !== null;
      const value = logged?.[macro.key] ?? 0;
      return {
        label: this.t(macro.labelKey),
        value: goal > 0 ? Math.min(1, value / goal) : 0,
        tone: macro.tone,
        text: this.t('home.summary.macroText', {
          eaten: hasData ? formatGrams(value) : NO_VALUE,
          goal,
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
