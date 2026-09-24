import { Injectable, Signal, computed, inject } from '@angular/core';
import { MACRO_SPLIT, KCAL_PER_GRAM } from '../../../core/constants/nutrition';
import { AdaptiveGoalService } from '../../../core/services/adaptive-goal/adaptive-goal';
import { BarcodeScannerService } from '../../../core/services/barcode-scanner/barcode-scanner';
import { CollectionsService } from '../../../core/services/collections/collections';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { WeightLogService } from '../../../core/services/weight-log/weight-log';
import { formatDecimal, formatInteger } from '../../../core/utils/date-format';

/** The color family behind a badge. Used for the ring, border, fill, and text alike. */
export type AchievementTone = 'accent' | 'positive' | 'info' | 'negative' | 'neutral';

export interface Achievement {
  readonly id: string;
  /** The glyph in the middle of the circle – the design's `icon` (text, not a registry icon). */
  readonly glyph: string;
  readonly label: string;
  readonly tone: AchievementTone;
  /** Share 0..1 of the goal. */
  readonly progress: number;
  readonly complete: boolean;
  /** "Klaret" · "Mangler" · "4/7 dage". */
  readonly progressLabel: string;
}

/** A day counts as "hit" once at least 95% of the goal has been eaten. */
const DAY_HIT_THRESHOLD = 0.95;

const TONE_BY_TARGET = {
  STREAK: 'positive',
  WEIGH: 'accent',
  MEALS: 'info',
  KG: 'accent',
  PROTEIN: 'negative',
  COLLECTION: 'positive',
  SCAN: 'info',
  SNACK: 'neutral',
  WEEK: 'accent',
} as const satisfies Readonly<Record<string, AchievementTone>>;

interface AchievementSeed {
  readonly id: string;
  readonly glyph: string;
  readonly label: string;
  readonly value: number;
  readonly target: number;
  readonly unit: string;
  readonly tone: AchievementTone;
}

interface WeekStats {
  readonly hitDays: number;
  readonly proteinHitDays: number;
  readonly streakDays: number;
}

/**
 * The 12 achievements on the profile page.
 *
 * All numbers come from the user's own data: the food log, weigh-ins, collections, and the
 * scan count. The app has no history beyond today, so the weekly counters can at most reach
 * 1 until the backend supplies earlier days.
 */
@Injectable({ providedIn: 'root' })
export class AchievementsService {
  private readonly profiles = inject(UserProfileService);
  private readonly adaptiveGoal = inject(AdaptiveGoalService);
  private readonly foodLog = inject(FoodLogService);
  private readonly weightLog = inject(WeightLogService);
  private readonly collections = inject(CollectionsService);
  private readonly scanner = inject(BarcodeScannerService);

  readonly achievements: Signal<readonly Achievement[]> = computed(() =>
    this.seeds().map((seed) => toAchievement(seed)),
  );

  /**
   * The week's numbers. Only today has data, so each counter is 0 or 1 until the backend
   * can supply the earlier days.
   */
  private readonly weekStats: Signal<WeekStats> = computed(() => {
    const kcalTarget = this.adaptiveGoal.kcalTarget();
    const totals = this.foodLog.totals();
    const proteinGoalPerDay = Math.round(
      (kcalTarget * MACRO_SPLIT.protein) / KCAL_PER_GRAM.protein,
    );
    const kcalPart = kcalTarget > 0 ? Math.min(1, totals.kcal / kcalTarget) : 0;
    const kcalHitToday = kcalPart >= DAY_HIT_THRESHOLD;
    const proteinHitToday = totals.protein >= proteinGoalPerDay * DAY_HIT_THRESHOLD;
    return {
      hitDays: kcalHitToday ? 1 : 0,
      proteinHitDays: proteinHitToday ? 1 : 0,
      streakDays: kcalHitToday ? 1 : 0,
    };
  });

  /** Drop from the oldest weigh-in to the current weight. Only a decrease counts. */
  private readonly kgLost = computed(() => {
    const current = this.profiles.profile().weightKg;
    const first = this.weightLog.entries().at(-1);
    return Math.max(0, (first?.kg ?? current) - current);
  });

  private readonly seeds: Signal<readonly AchievementSeed[]> = computed(() => {
    const week = this.weekStats();
    const loggedCount = this.foodLog.entries().length;
    const kgLost = this.kgLost();
    return [
      {
        id: 'streak-7',
        glyph: '7',
        label: '7 dages streak',
        value: Math.min(week.streakDays, 7),
        target: 7,
        unit: 'dage',
        tone: TONE_BY_TARGET.STREAK,
      },
      {
        id: 'first-weigh',
        glyph: 'kg',
        label: 'Første vejning',
        value: this.weightLog.entries().length > 0 ? 1 : 0,
        target: 1,
        unit: '',
        tone: TONE_BY_TARGET.WEIGH,
      },
      {
        id: 'meals-10',
        glyph: '10',
        label: '10 måltider',
        value: loggedCount,
        target: 10,
        unit: 'måltider',
        tone: TONE_BY_TARGET.MEALS,
      },
      {
        id: 'lost-2',
        glyph: '−2',
        label: '2 kg tabt',
        value: kgLost,
        target: 2,
        unit: 'kg',
        tone: TONE_BY_TARGET.KG,
      },
      {
        id: 'protein-5',
        glyph: 'P',
        label: 'Protein-mål 5x',
        value: week.proteinHitDays,
        target: 5,
        unit: 'dage',
        tone: TONE_BY_TARGET.PROTEIN,
      },
      {
        id: 'own-collection',
        glyph: '✎',
        label: 'Egen samling',
        value: this.collections.userCollections().length > 0 ? 1 : 0,
        target: 1,
        unit: '',
        tone: TONE_BY_TARGET.COLLECTION,
      },
      {
        id: 'streak-30',
        glyph: '30',
        label: '30 dages streak',
        value: Math.min(week.streakDays, 30),
        target: 30,
        unit: 'dage',
        tone: TONE_BY_TARGET.STREAK,
      },
      {
        id: 'meals-50',
        glyph: '50',
        label: '50 måltider',
        value: loggedCount,
        target: 50,
        unit: 'måltider',
        tone: TONE_BY_TARGET.MEALS,
      },
      {
        id: 'lost-5',
        glyph: '−5',
        label: '5 kg tabt',
        value: kgLost,
        target: 5,
        unit: 'kg',
        tone: TONE_BY_TARGET.KG,
      },
      {
        id: 'scans-10',
        glyph: '⚡',
        label: '10 scanninger',
        value: this.scanner.scanCount(),
        target: 10,
        unit: 'scan',
        tone: TONE_BY_TARGET.SCAN,
      },
      {
        id: 'no-late-snack',
        glyph: '☾',
        label: 'Ingen sen snack',
        value: week.hitDays,
        target: 7,
        unit: 'dage',
        tone: TONE_BY_TARGET.SNACK,
      },
      {
        id: 'perfect-week',
        glyph: '★',
        label: 'Perfekt uge',
        value: week.hitDays,
        target: 7,
        unit: 'dage',
        tone: TONE_BY_TARGET.WEEK,
      },
    ];
  });
}

function toAchievement(seed: AchievementSeed): Achievement {
  const progress = Math.max(0, Math.min(1, seed.value / seed.target));
  const complete = seed.value >= seed.target;
  return {
    id: seed.id,
    glyph: seed.glyph,
    label: seed.label,
    tone: seed.tone,
    progress,
    complete,
    progressLabel: progressLabelFor(seed, complete),
  };
}

function progressLabelFor(seed: AchievementSeed, complete: boolean): string {
  if (complete) {
    return 'Klaret';
  }
  if (seed.target === 1) {
    return 'Mangler';
  }
  const value = Number.isInteger(seed.value)
    ? formatInteger(seed.value)
    : formatDecimal(seed.value, 1);
  return seed.unit ? `${value}/${seed.target} ${seed.unit}` : `${value}/${seed.target}`;
}
