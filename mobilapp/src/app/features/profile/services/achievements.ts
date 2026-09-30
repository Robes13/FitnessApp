import { Injectable, Signal, computed, inject } from '@angular/core';
import { BarcodeScannerService } from '../../../core/services/barcode-scanner/barcode-scanner';
import { CollectionsService } from '../../../core/services/collections/collections';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { WeightLogService } from '../../../core/services/weight-log/weight-log';
import { Translate, injectTranslate } from '../../../core/services/language/translate';
import { formatDecimal, formatInteger } from '../../../core/utils/date-format';
import { IconName } from '../../../shared/components/ui-icon/icon-registry';

/** The color family behind a badge. Used for the ring, border, fill, and text alike. */
export type AchievementTone = 'accent' | 'positive' | 'info' | 'negative' | 'neutral';

export interface Achievement {
  readonly id: string;
  /** The text in the middle of the circle ("7", "kg" …) – empty when the badge has an `icon`. */
  readonly glyph: string;
  /**
   * A registry icon instead of the text. The design's symbol glyphs (✎ ⚡ ☾ ★) are drawn as
   * icons, because iOS and Android render those characters as different, coloured emoji.
   */
  readonly icon: IconName | null;
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
  readonly glyph?: string;
  readonly icon?: IconName;
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
  private readonly foodLog = inject(FoodLogService);
  private readonly weightLog = inject(WeightLogService);
  private readonly collections = inject(CollectionsService);
  private readonly scanner = inject(BarcodeScannerService);
  private readonly t = injectTranslate();

  readonly achievements: Signal<readonly Achievement[]> = computed(() =>
    this.seeds().map((seed) => toAchievement(this.t, seed)),
  );

  /**
   * The week's numbers. Only today has data, so each counter is 0 or 1 until the backend
   * can supply the earlier days.
   */
  private readonly weekStats: Signal<WeekStats> = computed(() => {
    const { kcal: kcalTarget, protein: proteinGoalPerDay } = this.profiles.targets();
    const totals = this.foodLog.totals();
    const kcalPart = kcalTarget > 0 ? Math.min(1, totals.kcal / kcalTarget) : 0;
    const kcalHitToday = kcalPart >= DAY_HIT_THRESHOLD;
    const proteinHitToday =
      proteinGoalPerDay > 0 && totals.protein >= proteinGoalPerDay * DAY_HIT_THRESHOLD;
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
    const t = this.t;
    return [
      {
        id: 'streak-7',
        glyph: '7',
        label: t('profile.achievements.streak7'),
        value: Math.min(week.streakDays, 7),
        target: 7,
        unit: t('profile.achievements.unitDays'),
        tone: TONE_BY_TARGET.STREAK,
      },
      {
        id: 'first-weigh',
        glyph: t('common.unit.kg'),
        label: t('profile.achievements.firstWeigh'),
        value: this.weightLog.entries().length > 0 ? 1 : 0,
        target: 1,
        unit: '',
        tone: TONE_BY_TARGET.WEIGH,
      },
      {
        id: 'meals-10',
        glyph: '10',
        label: t('profile.achievements.meals10'),
        value: loggedCount,
        target: 10,
        unit: t('profile.achievements.unitMeals'),
        tone: TONE_BY_TARGET.MEALS,
      },
      {
        id: 'lost-2',
        glyph: '−2',
        label: t('profile.achievements.lost2'),
        value: kgLost,
        target: 2,
        unit: t('common.unit.kg'),
        tone: TONE_BY_TARGET.KG,
      },
      {
        id: 'protein-5',
        glyph: t('profile.achievements.proteinGlyph'),
        label: t('profile.achievements.protein5'),
        value: week.proteinHitDays,
        target: 5,
        unit: t('profile.achievements.unitDays'),
        tone: TONE_BY_TARGET.PROTEIN,
      },
      {
        id: 'own-collection',
        icon: 'pencil',
        label: t('profile.achievements.ownCollection'),
        value: this.collections.userCollections().length > 0 ? 1 : 0,
        target: 1,
        unit: '',
        tone: TONE_BY_TARGET.COLLECTION,
      },
      {
        id: 'streak-30',
        glyph: '30',
        label: t('profile.achievements.streak30'),
        value: Math.min(week.streakDays, 30),
        target: 30,
        unit: t('profile.achievements.unitDays'),
        tone: TONE_BY_TARGET.STREAK,
      },
      {
        id: 'meals-50',
        glyph: '50',
        label: t('profile.achievements.meals50'),
        value: loggedCount,
        target: 50,
        unit: t('profile.achievements.unitMeals'),
        tone: TONE_BY_TARGET.MEALS,
      },
      {
        id: 'lost-5',
        glyph: '−5',
        label: t('profile.achievements.lost5'),
        value: kgLost,
        target: 5,
        unit: t('common.unit.kg'),
        tone: TONE_BY_TARGET.KG,
      },
      {
        id: 'scans-10',
        icon: 'bolt',
        label: t('profile.achievements.scans10'),
        value: this.scanner.scanCount(),
        target: 10,
        unit: t('profile.achievements.unitScans'),
        tone: TONE_BY_TARGET.SCAN,
      },
      {
        id: 'no-late-snack',
        icon: 'moon',
        label: t('profile.achievements.noLateSnack'),
        value: week.hitDays,
        target: 7,
        unit: t('profile.achievements.unitDays'),
        tone: TONE_BY_TARGET.SNACK,
      },
      {
        id: 'perfect-week',
        icon: 'star',
        label: t('profile.achievements.perfectWeek'),
        value: week.hitDays,
        target: 7,
        unit: t('profile.achievements.unitDays'),
        tone: TONE_BY_TARGET.WEEK,
      },
    ];
  });
}

function toAchievement(t: Translate, seed: AchievementSeed): Achievement {
  const progress = Math.max(0, Math.min(1, seed.value / seed.target));
  const complete = seed.value >= seed.target;
  return {
    id: seed.id,
    glyph: seed.glyph ?? '',
    icon: seed.icon ?? null,
    label: seed.label,
    tone: seed.tone,
    progress,
    complete,
    progressLabel: progressLabelFor(t, seed, complete),
  };
}

function progressLabelFor(t: Translate, seed: AchievementSeed, complete: boolean): string {
  if (complete) {
    return t('profile.achievements.complete');
  }
  if (seed.target === 1) {
    return t('profile.achievements.missing');
  }
  const value = Number.isInteger(seed.value)
    ? formatInteger(seed.value)
    : formatDecimal(seed.value, 1);
  return seed.unit
    ? t('profile.achievements.progress', { value, target: seed.target, unit: seed.unit })
    : `${value}/${seed.target}`;
}
