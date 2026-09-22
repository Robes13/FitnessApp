import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { APP_PATH, QUERY_PARAM } from '../../../core/constants/app-route';
import { MEALS } from '../../../core/constants/meals';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../core/constants/nutrition';
import { Macros } from '../../../core/models/food';
import { ProfilePhoto } from '../../../core/models/profile';
import { FoodLogService } from '../../../core/services/food-log';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator';
import { UserProfileService } from '../../../core/services/user-profile';
import { WeightLogService } from '../../../core/services/weight-log';
import {
  DAY_NAMES_LONG,
  DAY_NAMES_SHORT,
  formatDayLabel,
  formatDecimal,
  formatInteger,
  formatWeightKg,
  mondayIndex,
} from '../../../core/utils/date-format';
import { clamp } from '../../../core/utils/math';
import { NOW } from '../../../core/utils/now';
import { ProgressBarTone } from '../../../shared/components/ui-progress-bar/ui-progress-bar';

/** Ringens farve: grøn ved lukket ring, orange undervejs, tom for dage der ikke er kommet. */
export type RingTone = 'positive' | 'accent' | 'none';

export interface WeekRing {
  readonly index: number;
  readonly label: string;
  readonly dashOffset: number;
  readonly tone: RingTone;
  /** Færdigbygget BEM-modifier til ringens streg, så templaten slipper for at samle klassenavnet. */
  readonly toneClass: string;
  readonly isToday: boolean;
  readonly isFuture: boolean;
  readonly isSelected: boolean;
}

export interface DayMacro {
  readonly label: string;
  /** Andel af dagsmålet, 0..1. */
  readonly value: number;
  readonly tone: ProgressBarTone;
  readonly text: string;
}

export interface DaySummary {
  readonly title: string;
  /** Andel af kaloriemålet, 0..1. */
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
  /** Andel af vejen til målvægten, 0,04..1 som i designet. */
  readonly progress: number;
  readonly coach: string;
}

export interface HomeTodo {
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly queryParams: Record<string, string> | null;
}

/** Designets demo-historik (`dayHist`) for ugens dage før i dag. */
const DAY_HISTORY: readonly number[] = [1, 0.97, 0.86, 1, 1, 0.72, 0.95];

const NO_VALUE = '–';

/** Omkredsen af dagsringen (r = 16 i et 40×40 viewBox). */
const RING_CIRCUMFERENCE = 100.5;
const RING_FULL_THRESHOLD = 0.98;
/** BEM-block for dagsringens streg i `HomeWeekRings` — bruges til at bygge tone-modifieren. */
const RING_PROGRESS_BLOCK = 'home-week-rings__progress';

const WEEK_HIT_THRESHOLD = 0.95;
const STREAK_BONUS_DAYS = 3;
const SOLID_WEEK_MIN_HITS = 2;

/** Syntetiske historiske tal fra designet: dagens andel skaleres let op mod målet. */
const HISTORIC_PROTEIN_BASE = 0.88;
const HISTORIC_PROTEIN_SPAN = 0.16;
const HISTORIC_MACRO_BASE = 0.88;
const HISTORIC_MACRO_STEP = 0.06;
const HISTORIC_MACRO_VARIANTS = 5;
const HISTORIC_MACRO_DAY_FACTOR = 3;
const HISTORIC_MACRO_INDEX_FACTOR = 7;

/** Vægten falder 0,2 kg pr. dag bagud i designets demo-tal, dog højst 14 dage. */
const WEIGHT_DRIFT_PER_DAY_KG = 0.2;
const WEIGHT_DRIFT_MAX_DAYS = 14;

const GOAL_REACHED_MARGIN_KG = 0.05;
const MIN_GOAL_PROGRESS = 0.04;
const DEFAULT_PACE_RATE_LABEL = '0,5 kg/uge';
const DEFAULT_PACE_KG_PER_WEEK = 0.5;

interface MacroDefinition {
  readonly label: string;
  readonly key: keyof Omit<Macros, 'kcal'>;
  readonly tone: ProgressBarTone;
}

const MACRO_DEFINITIONS: readonly MacroDefinition[] = [
  { label: 'Protein', key: 'protein', tone: 'accent' },
  { label: 'Kulhydrat', key: 'carbs', tone: 'selected' },
  { label: 'Fedt', key: 'fat', tone: 'secondary' },
];

/**
 * Samler Hjem-skærmens tal ét sted: ugens ringe, den valgte dags kort, ugens nøgletal,
 * næste skridt og målkortet.
 *
 * Kun i dag er rigtige data (madloggen og vejningerne). Ugens tidligere dage er designets
 * syntetiske demo-historik (`DAY_HISTORY`), og de samme formler bruges til makroer, protein
 * og dagens vægt, så skærmen ser ud som prototypen. Fremtidige dage er tomme.
 *
 * Servicen er `providedIn: 'root'`, så den valgte dag overlever et faneskift. Fejrings-toastens
 * timere hører til siden og ligger derfor i `HomePage`.
 */
@Injectable({ providedIn: 'root' })
export class HomeSummaryService {
  private readonly profileService = inject(UserProfileService);
  private readonly foodLog = inject(FoodLogService);
  private readonly weightLog = inject(WeightLogService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);

  /** `null` = følg dagen i dag, som designets `s.selDay ?? todayIdx`. */
  private readonly selected = signal<number | null>(null);

  /** 0 = mandag … 6 = søndag. */
  readonly todayIndex = computed(() => mondayIndex(this.now()));
  readonly selectedDay = computed(() => this.selected() ?? this.todayIndex());

  readonly displayName = this.profileService.displayName;
  readonly initial = this.profileService.initial;
  readonly kcalTarget = this.profileService.kcalTarget;
  readonly todayLabel = computed(() => formatDayLabel(this.now()));
  readonly weekProgressLabel = computed(() => `Dag ${this.todayIndex() + 1} af 7`);

  /** Profilbilledet til avataren i headeren; `null` viser forbogstavet i stedet. */
  readonly photo: Signal<ProfilePhoto | null> = computed(() => this.profileService.profile().photo);

  /** Andel af dagens kaloriemål pr. ugedag. */
  private readonly dayParts = computed<readonly number[]>(() => {
    const today = this.todayIndex();
    const target = this.kcalTarget();
    const eaten = this.foodLog.totals().kcal;
    const todayPart = target > 0 ? Math.min(1, eaten / target) : 0;
    return DAY_NAMES_SHORT.map((_, index) => {
      if (index === today) {
        return todayPart;
      }
      return index > today ? 0 : (DAY_HISTORY[index] ?? 0);
    });
  });

  /** Sandt så snart dagens kalorier når målet – udløser fejrings-toasten. */
  readonly goalReached = computed(() => (this.dayParts()[this.todayIndex()] ?? 0) >= 1);

  readonly weekRings = computed<readonly WeekRing[]>(() => {
    const today = this.todayIndex();
    const selected = this.selectedDay();
    return this.dayParts().map((part, index) => {
      const tone: RingTone =
        index > today ? 'none' : part >= RING_FULL_THRESHOLD ? 'positive' : 'accent';
      return {
        index,
        label: DAY_NAMES_SHORT[index] ?? '',
        dashOffset: RING_CIRCUMFERENCE * (1 - part),
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
    const part = this.dayParts()[selected] ?? 0;
    const isFuture = selected > today;
    const target = this.kcalTarget();
    return {
      title: `${DAY_NAMES_LONG[selected] ?? ''}${relativeDaySuffix(selected, today)}`,
      progress: part,
      progressTone: isFuture ? 'muted' : part >= RING_FULL_THRESHOLD ? 'positive' : 'accent',
      kcalEatenText: isFuture ? NO_VALUE : String(Math.round(part * target)),
      kcalTargetText: String(target),
      weightText: isFuture ? NO_VALUE : formatDecimal(this.weightForDay(selected)),
      macros: this.macrosForDay(selected, isFuture, part),
    };
  });

  private readonly proteinGoalPerDay = computed(
    () => this.calculator.macroGoals(this.kcalTarget()).protein,
  );

  private readonly weekStats = computed(() => {
    const today = this.todayIndex();
    const parts = this.dayParts();
    const target = this.kcalTarget();
    const proteinGoal = this.proteinGoalPerDay();
    const loggedProtein = this.foodLog.totals().protein;
    const days = today + 1;
    const elapsed = parts.slice(0, days);

    const hit = elapsed.filter((part) => part >= WEEK_HIT_THRESHOLD).length;
    const averageKcal = Math.round(
      elapsed.reduce((total, part) => total + part * target, 0) / Math.max(1, days),
    );
    const proteinHit = elapsed.filter((part, index) => {
      const protein =
        index === today
          ? loggedProtein
          : Math.round(proteinGoal * part * (HISTORIC_PROTEIN_BASE + part * HISTORIC_PROTEIN_SPAN));
      return protein >= proteinGoal * WEEK_HIT_THRESHOLD;
    }).length;

    let streak = 0;
    for (let index = today - 1; index >= 0; index--) {
      if ((parts[index] ?? 0) >= WEEK_HIT_THRESHOLD) {
        streak++;
      } else {
        break;
      }
    }
    if ((parts[today] ?? 0) >= WEEK_HIT_THRESHOLD) {
      streak++;
    }

    return { days, hit, averageKcal, proteinHit, streakDays: streak + STREAK_BONUS_DAYS };
  });

  readonly weekSummary = computed<WeekSummary>(() => {
    const { days, hit, averageKcal, proteinHit, streakDays } = this.weekStats();
    return {
      progressLabel: this.weekProgressLabel(),
      hitText: String(hit),
      averageKcalText: formatInteger(averageKcal),
      proteinHitText: String(proteinHit),
      streakText: `${streakDays} dage`,
      note: weekNote(hit, days),
    };
  });

  readonly todos = computed<readonly HomeTodo[]>(() => {
    const todos: HomeTodo[] = [];
    if (!this.weightLog.weighedToday()) {
      todos.push({
        title: 'Husk at veje dig i dag',
        subtitle: 'Tryk her for at registrere din vægt',
        path: APP_PATH.WEIGHT,
        queryParams: null,
      });
    }
    const byMeal = this.foodLog.byMeal();
    for (const meal of MEALS) {
      if ((byMeal.get(meal.id) ?? []).length === 0) {
        todos.push({
          title: `Log din ${meal.label.toLowerCase()}`,
          subtitle: 'Ikke registreret endnu',
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
    return count > 1 ? `1 / ${count}` : 'Kun én';
  });

  /** Målkortet er skjult, når målet er at holde vægten. */
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
      toGoalText: reached ? 'Nået!' : `${formatDecimal(left)} kg`,
      goalWeightText: formatWeightKg(target),
      progress: clamp(1 - left / totalDistance, MIN_GOAL_PROGRESS, 1),
      coach: reached
        ? 'Du har ramt dit mål – overvej at skifte til "Holde vægten".'
        : goal === 'hold'
          ? `Du holder dig inden for ±${formatDecimal(left)} kg af din målvægt.`
          : `Med dit tempo på ${pace?.rateLabel ?? DEFAULT_PACE_RATE_LABEL} er du der om ca. ${weeks} uger.`,
    };
  });

  selectDay(index: number): void {
    this.selected.set(index);
  }

  /** Designets `pts[11]` minus 0,2 kg pr. dag tilbage i tiden. */
  private weightForDay(index: number): number {
    const { weightKg, goal } = this.profileService.profile();
    const series = this.weightLog.seriesFor('1u', goal, weightKg);
    const latest = series.at(-1)?.kg ?? weightKg;
    const daysBack = Math.min(WEIGHT_DRIFT_MAX_DAYS, this.todayIndex() - index);
    return latest - daysBack * WEIGHT_DRIFT_PER_DAY_KG;
  }

  private macrosForDay(index: number, isFuture: boolean, part: number): readonly DayMacro[] {
    const goals = this.calculator.macroGoals(this.kcalTarget());
    const logged = this.foodLog.totals();
    const isToday = index === this.todayIndex();
    return MACRO_DEFINITIONS.map((macro, macroIndex) => {
      const goal = goals[macro.key];
      const value = isFuture
        ? 0
        : isToday
          ? logged[macro.key]
          : Math.round(goal * part * historicMacroFactor(index, macroIndex));
      return {
        label: macro.label,
        value: goal > 0 ? Math.min(1, value / goal) : 0,
        tone: macro.tone,
        text: `${isFuture ? NO_VALUE : value} / ${goal} g`,
      };
    });
  }
}

/** `' · i dag'` / `' · i går'` / `''` som i designets `dayTitle`. */
function relativeDaySuffix(selected: number, today: number): string {
  if (selected === today) {
    return ' · i dag';
  }
  return selected === today - 1 ? ' · i går' : '';
}

function weekNote(hit: number, days: number): string {
  if (hit >= days - 1) {
    return 'Stærk uge – bliv ved.';
  }
  return hit >= SOLID_WEEK_MIN_HITS
    ? 'Solid uge. Protein er det, der løfter resten.'
    : 'Ujævn uge. Sæt et enkelt mål: ram protein i morgen.';
}

function historicMacroFactor(dayIndex: number, macroIndex: number): number {
  const variant =
    (dayIndex * HISTORIC_MACRO_DAY_FACTOR + macroIndex * HISTORIC_MACRO_INDEX_FACTOR) %
    HISTORIC_MACRO_VARIANTS;
  return HISTORIC_MACRO_BASE + variant * HISTORIC_MACRO_STEP;
}
