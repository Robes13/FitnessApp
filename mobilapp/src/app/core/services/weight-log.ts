import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { DEMO_WEIGHT_SEED } from '../constants/demo-data';
import { STORAGE_KEY } from '../constants/storage-key';
import {
  WEIGHT_RANGE_DAYS,
  WEIGHT_RANGE_LABEL,
  WEIGHT_SERIES_DRIFT_KG,
  WEIGHT_SERIES_DRIFT_REFERENCE_DAYS,
  WEIGHT_SERIES_POINTS,
  WEIGHT_SERIES_WOBBLE_AMPLITUDE_KG,
  WEIGHT_SERIES_WOBBLE_FREQUENCY,
} from '../constants/weight';
import { GoalId } from '../models/profile';
import { WeighEntry, WeightPoint, WeightRange } from '../models/weight';
import { addDays, isSameDay } from '../utils/date-format';
import { NOW } from '../utils/now';
import { IdService } from './id';
import { StorageService } from './storage';
import { UserProfileService } from './user-profile';

const ONE_DECIMAL = 10;

/**
 * Vejninger, nyeste først. `add()` opdaterer også profilens vægt, så Hjem, Mad og
 * kalorieberegningen følger med.
 *
 * Første gang (ingen gemt log) seedes designets tre demo-vejninger for 3, 7 og 14 dage siden ud
 * fra profilens vægt og mål. `seriesFor()` er designets syntetiske graf (`pts`) – ikke rigtige data.
 */
@Injectable({ providedIn: 'root' })
export class WeightLogService {
  private readonly storage = inject(StorageService);
  private readonly ids = inject(IdService);
  private readonly now = inject(NOW);
  private readonly profile = inject(UserProfileService);
  private readonly entriesState = signal<readonly WeighEntry[]>(this.restore());

  readonly entries: Signal<readonly WeighEntry[]> = this.entriesState.asReadonly();
  readonly latest: Signal<WeighEntry | null> = computed(() => this.entriesState()[0] ?? null);
  readonly weighedToday: Signal<boolean> = computed(() => {
    const latest = this.latest();
    return latest !== null && isSameDay(new Date(latest.at), this.now());
  });

  add(kg: number, at: Date = this.now()): WeighEntry {
    const entry: WeighEntry = {
      id: this.ids.next('weigh'),
      kg: roundToOneDecimal(kg),
      at: at.toISOString(),
    };
    this.setEntries(sortNewestFirst([entry, ...this.entriesState()]));
    this.profile.update({ weightKg: entry.kg });
    return entry;
  }

  /** 12 punkter fra `range` dage siden til nu, med drift efter mål og en let bølge. */
  seriesFor(range: WeightRange, goal: GoalId | null, currentKg: number): readonly WeightPoint[] {
    const days = WEIGHT_RANGE_DAYS[range];
    const drift = WEIGHT_SERIES_DRIFT_KG[goal ?? 'tabe'];
    const now = this.now();
    const lastIndex = WEIGHT_SERIES_POINTS - 1;
    return Array.from({ length: WEIGHT_SERIES_POINTS }, (_, index) => {
      const progress = index / lastIndex;
      const kg =
        currentKg +
        drift * (1 - progress) * (days / WEIGHT_SERIES_DRIFT_REFERENCE_DAYS) +
        Math.sin(index * WEIGHT_SERIES_WOBBLE_FREQUENCY) * WEIGHT_SERIES_WOBBLE_AMPLITUDE_KG;
      return { kg, at: addDays(now, -Math.round(days * (1 - progress))).toISOString() };
    });
  }

  rangeLabel(range: WeightRange): string {
    return WEIGHT_RANGE_LABEL[range];
  }

  private setEntries(entries: readonly WeighEntry[]): void {
    this.entriesState.set(entries);
    this.storage.write(STORAGE_KEY.WEIGHT_LOG, entries);
  }

  private restore(): readonly WeighEntry[] {
    const stored = this.storage.read<readonly WeighEntry[]>(STORAGE_KEY.WEIGHT_LOG);
    if (stored) {
      return sortNewestFirst(stored);
    }
    const seeded = this.seed();
    this.storage.write(STORAGE_KEY.WEIGHT_LOG, seeded);
    return seeded;
  }

  private seed(): readonly WeighEntry[] {
    const { weightKg, goal } = this.profile.profile();
    const now = this.now();
    return DEMO_WEIGHT_SEED.map((seed) => ({
      id: this.ids.next('weigh'),
      kg: roundToOneDecimal(weightKg + (goal === 'tage' ? seed.deltaKgWhenGaining : seed.deltaKg)),
      at: addDays(now, -seed.daysAgo).toISOString(),
    }));
  }
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * ONE_DECIMAL) / ONE_DECIMAL;
}

function sortNewestFirst(entries: readonly WeighEntry[]): readonly WeighEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at));
}
