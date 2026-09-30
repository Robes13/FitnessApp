import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { newId } from '../../utils/id';
import { STORAGE_KEY } from '../../constants/storage-key';
import { WEIGHT_RANGE_DAYS, WEIGHT_RANGE_LABEL_KEY } from '../../constants/weight';
import { WeighEntry, WeightPoint, WeightRange } from '../../models/weight';
import { addDays, isSameDay } from '../../utils/date-format';
import { roundTo } from '../../utils/math';
import { NOW } from '../../utils/now';
import { injectTranslate } from '../language/translate';
import { SessionDataStore } from '../session-data/session-data';
import { StorageService } from '../storage/storage';
import { UserProfileService } from '../user-profile/user-profile';

/**
 * Weigh-ins, newest first. Every change (`add`, `update`, `remove`) keeps the profile's weight
 * equal to the latest weigh-in, so Home, Food and the calorie calculation stay in sync.
 *
 * At most one weigh-in per calendar day: recording again on a day that already has a weigh-in
 * replaces that day's entry instead of adding a duplicate.
 *
 * The log starts empty: there are no weigh-ins until the user records one themselves.
 */
@Injectable({ providedIn: 'root' })
export class WeightLogService implements SessionDataStore {
  private readonly storage = inject(StorageService);
  private readonly now = inject(NOW);
  private readonly profile = inject(UserProfileService);
  private readonly t = injectTranslate();
  private readonly entriesState = signal<readonly WeighEntry[]>(this.restore());

  readonly entries: Signal<readonly WeighEntry[]> = this.entriesState.asReadonly();
  readonly latest: Signal<WeighEntry | null> = computed(() => this.entriesState()[0] ?? null);
  readonly weighedToday: Signal<boolean> = computed(() => {
    const latest = this.latest();
    return latest !== null && isSameDay(new Date(latest.at), this.now());
  });

  /**
   * Records a weigh-in. If the day of `at` already has one, the newest of them keeps its id and
   * gets the new weight and time – so weighing in twice a day updates the day's weigh-in. Every
   * other entry from that day (legacy data can have several) is dropped.
   */
  add(kg: number, at: Date = this.now()): WeighEntry {
    const current = this.entriesState();
    const sameDay = current.find((entry) => isSameDay(new Date(entry.at), at));
    const entry: WeighEntry = {
      id: sameDay?.id ?? newId('weigh'),
      kg: roundTo(kg, 1),
      at: at.toISOString(),
    };
    const others = current.filter((existing) => !isSameDay(new Date(existing.at), at));
    this.commit(sortNewestFirst([entry, ...others]));
    return entry;
  }

  /** Corrects the weight of an existing weigh-in (time unchanged). `null` if the id is unknown. */
  update(id: string, kg: number): WeighEntry | null {
    const existing = this.entriesState().find((entry) => entry.id === id);
    if (!existing) {
      return null;
    }
    const updated: WeighEntry = { ...existing, kg: roundTo(kg, 1) };
    this.commit(this.entriesState().map((entry) => (entry.id === id ? updated : entry)));
    return updated;
  }

  /**
   * Deletes a weigh-in. The profile's weight follows the new latest weigh-in; deleting the only
   * one leaves the profile's weight as it is (it is still the user's last known weight).
   */
  remove(id: string): boolean {
    const remaining = this.entriesState().filter((entry) => entry.id !== id);
    if (remaining.length === this.entriesState().length) {
      return false;
    }
    this.commit(remaining);
    return true;
  }

  /** The weigh-ins within the range, newest first. */
  entriesWithin(range: WeightRange): readonly WeighEntry[] {
    const from = addDays(this.now(), -WEIGHT_RANGE_DAYS[range]).getTime();
    return this.entriesState().filter((entry) => new Date(entry.at).getTime() >= from);
  }

  /** The weigh-ins within the range, oldest first. Empty until the user has weighed in. */
  seriesFor(range: WeightRange): readonly WeightPoint[] {
    return this.entriesWithin(range)
      .map((entry) => ({ kg: entry.kg, at: entry.at }))
      .reverse();
  }

  rangeLabel(range: WeightRange): string {
    return this.t(WEIGHT_RANGE_LABEL_KEY[range]);
  }

  /** Persists the entries and syncs the profile's weight to the latest one (if any). */
  private commit(entries: readonly WeighEntry[]): void {
    this.entriesState.set(entries);
    this.storage.write(STORAGE_KEY.WEIGHT_LOG, entries);
    const latest = entries[0];
    if (latest) {
      this.profile.update({ weightKg: latest.kg });
    }
  }

  private restore(): readonly WeighEntry[] {
    const stored = this.storage.read<readonly WeighEntry[]>(STORAGE_KEY.WEIGHT_LOG);
    return stored ? sortNewestFirst(stored) : [];
  }

  // Stub - replaced by the API-backed store in wave 2/3 (plan-v2 4).
  load(): Observable<void> {
    return of(undefined);
  }

  reset(): void {}
}

function sortNewestFirst(entries: readonly WeighEntry[]): readonly WeighEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at));
}
