import { Injectable, Signal, computed, inject } from '@angular/core';
import { MACRO_SPLIT, KCAL_PER_GRAM } from '../../../core/constants/nutrition';
import { BarcodeScannerService } from '../../../core/services/barcode-scanner';
import { CollectionsService } from '../../../core/services/collections';
import { FoodLogService } from '../../../core/services/food-log';
import { UserProfileService } from '../../../core/services/user-profile';
import { WeightLogService } from '../../../core/services/weight-log';
import { formatDecimal, formatInteger, mondayIndex } from '../../../core/utils/date-format';
import { NOW } from '../../../core/utils/now';

/** Farvefamilien bag et badge. Bruges både til ring, kant, fyld og tekst. */
export type AchievementTone = 'accent' | 'positive' | 'info' | 'negative' | 'neutral';

export interface Achievement {
  readonly id: string;
  /** Tegnet midt i cirklen – designets `icon` (tekst, ikke et ikon fra registret). */
  readonly glyph: string;
  readonly label: string;
  readonly tone: AchievementTone;
  /** Andel 0..1 af målet. */
  readonly progress: number;
  readonly complete: boolean;
  /** "Klaret" · "Mangler" · "4/7 dage". */
  readonly progressLabel: string;
}

/** Designets `dayHist`: kaloriedækning for ugens dage før i dag. */
const DAY_HISTORY: readonly number[] = [1, 0.97, 0.86, 1, 1, 0.72, 0.95];
/** En dag tæller som "ramt", når mindst 95 % af målet er spist. */
const DAY_HIT_THRESHOLD = 0.95;
/** Designets `streakDays = streakRun + 3` – demo-historik før ugens start. */
const STREAK_HISTORY_BONUS = 3;
/** Designets syntetiske proteintal for tidligere dage. */
const PROTEIN_DAY_BASE = 0.88;
const PROTEIN_DAY_SPREAD = 0.16;

/** Demo-forspring, så badges ikke står på nul i prototypen (designets `6 +`, `23 +`, `4 +`). */
const MEALS_LOGGED_HEAD_START = 6;
const MEALS_LOGGED_HEAD_START_LARGE = 23;
const SCANS_HEAD_START = 4;
/** Designets gulv under "kg tabt", så ringen altid viser lidt fremgang. */
const MIN_KG_LOST = 1.2;

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
 * De 12 præstationer på profilsiden – en tro port af designets `badges`.
 *
 * Tallene blandes bevidst: nogle kommer fra rigtige data (madlog, vejninger, samlinger,
 * scanninger), andre fra designets syntetiske uge (`dayHist`) og faste forspring, så
 * prototypen viser et realistisk mix af klarede og låste badges.
 */
@Injectable({ providedIn: 'root' })
export class AchievementsService {
  private readonly profiles = inject(UserProfileService);
  private readonly foodLog = inject(FoodLogService);
  private readonly weightLog = inject(WeightLogService);
  private readonly collections = inject(CollectionsService);
  private readonly scanner = inject(BarcodeScannerService);
  private readonly now = inject(NOW);

  readonly achievements: Signal<readonly Achievement[]> = computed(() =>
    this.seeds().map((seed) => toAchievement(seed)),
  );

  /** Ugens tal fra designets `weekHit` / `weekProteinHit` / `streakDays`. */
  private readonly weekStats: Signal<WeekStats> = computed(() => {
    const todayIndex = mondayIndex(this.now());
    const kcalTarget = this.profiles.kcalTarget();
    const totals = this.foodLog.totals();
    const proteinGoalPerDay = Math.round(
      (kcalTarget * MACRO_SPLIT.protein) / KCAL_PER_GRAM.protein,
    );
    const dayPart = (index: number): number => {
      if (index > todayIndex) {
        return 0;
      }
      if (index === todayIndex) {
        return Math.min(1, totals.kcal / kcalTarget);
      }
      return DAY_HISTORY[index] ?? 0;
    };
    const proteinOfDay = (index: number): number => {
      if (index > todayIndex) {
        return 0;
      }
      if (index === todayIndex) {
        return totals.protein;
      }
      const part = dayPart(index);
      return Math.round(proteinGoalPerDay * part * (PROTEIN_DAY_BASE + part * PROTEIN_DAY_SPREAD));
    };
    const weekDays = Array.from({ length: todayIndex + 1 }, (_, index) => index);
    let streakRun = 0;
    for (let index = todayIndex - 1; index >= 0; index--) {
      if (dayPart(index) < DAY_HIT_THRESHOLD) {
        break;
      }
      streakRun++;
    }
    if (dayPart(todayIndex) >= DAY_HIT_THRESHOLD) {
      streakRun++;
    }
    return {
      hitDays: weekDays.filter((index) => dayPart(index) >= DAY_HIT_THRESHOLD).length,
      proteinHitDays: weekDays.filter(
        (index) => proteinOfDay(index) >= proteinGoalPerDay * DAY_HIT_THRESHOLD,
      ).length,
      streakDays: streakRun + STREAK_HISTORY_BONUS,
    };
  });

  /** Fremgang mod målvægten i kg. Kun et fald tæller (designets `kgDown`). */
  private readonly kgLost = computed(() => {
    const latest = this.weightLog.latest();
    const current = this.profiles.profile().weightKg;
    return Math.max(0, (latest?.kg ?? current) - current);
  });

  private readonly seeds: Signal<readonly AchievementSeed[]> = computed(() => {
    const week = this.weekStats();
    const loggedCount = this.foodLog.entries().length;
    const kgLost = Math.max(MIN_KG_LOST, this.kgLost());
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
        value: MEALS_LOGGED_HEAD_START + loggedCount,
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
        value: MEALS_LOGGED_HEAD_START_LARGE + loggedCount,
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
        value: SCANS_HEAD_START + this.scanner.scanCount(),
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
