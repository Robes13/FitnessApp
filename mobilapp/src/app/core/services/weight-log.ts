import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { newId } from '../utils/id';
import { STORAGE_KEY } from '../constants/storage-key';
import { WEIGHT_RANGE_DAYS, WEIGHT_RANGE_LABEL } from '../constants/weight';
import { WeighEntry, WeightPoint, WeightRange } from '../models/weight';
import { addDays, isSameDay } from '../utils/date-format';
import { roundTo } from '../utils/math';
import { NOW } from '../utils/now';
import { StorageService } from './storage';
import { UserProfileService } from './user-profile';

/**
 * Weigh-ins, newest first. `add()` also updates the profile's weight, so Home, Food and
 * the calorie calculation stay in sync.
 *
 * The log starts empty: there are no weigh-ins until the user records one themselves.
 */
@Injectable({ providedIn: 'root' })
export class WeightLogService {
  private readonly storage = inject(StorageService);
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
      id: newId('weigh'),
      kg: roundTo(kg, 1),
      at: at.toISOString(),
    };
    this.setEntries(sortNewestFirst([entry, ...this.entriesState()]));
    this.profile.update({ weightKg: entry.kg });
    return entry;
  }

  /** The weigh-ins within the range, oldest first. Empty until the user has weighed in. */
  seriesFor(range: WeightRange): readonly WeightPoint[] {
    const from = addDays(this.now(), -WEIGHT_RANGE_DAYS[range]).getTime();
    return this.entriesState()
      .filter((entry) => new Date(entry.at).getTime() >= from)
      .map((entry) => ({ kg: entry.kg, at: entry.at }))
      .reverse();
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
    return stored ? sortNewestFirst(stored) : [];
  }
}

function sortNewestFirst(entries: readonly WeighEntry[]): readonly WeighEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at));
}
