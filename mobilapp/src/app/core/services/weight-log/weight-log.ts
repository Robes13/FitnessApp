import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, catchError, defer, map, of, switchMap, throwError } from 'rxjs';
import { PROFILE_ENDPOINT } from '../../constants/profile';
import {
  WEIGHT_ENDPOINT,
  WEIGHT_LOG_LOAD_LIMIT,
  WEIGHT_RANGE_DAYS,
  WEIGHT_RANGE_LABEL_KEY,
} from '../../constants/weight';
import { CursorPage, StoreStatus } from '../../models/api';
import { LatestWeightDto } from '../../models/profile-api';
import {
  CreateWeightLogRequest,
  UpdateWeightLogRequest,
  WeighEntry,
  WeightLogDto,
  WeightPoint,
  WeightRange,
  WeightSaveResult,
} from '../../models/weight';
import {
  fetchAllPages,
  injectApiUrl,
  mapApiError,
  parseApiDateTime,
  readProblemBody,
  toApiError,
} from '../../utils/api';
import { addDays } from '../../utils/date-format';
import { roundTo } from '../../utils/math';
import { NOW } from '../../utils/now';
import { injectTranslate } from '../language/translate';
import { SessionDataStore } from '../session-data/session-data';
import { UserProfileService } from '../user-profile/user-profile';

/**
 * The user's weigh-ins from the API, newest first.
 *
 * `load()` only fetches the list – the profile's `load()` sets `weightKg` (the newest weigh-in or
 * the starting weight). Mutations are pessimistic: the list changes once the API has answered.
 * The API recalculates the goal on every mutation, so each one ends by setting the profile's
 * weight to the newest weigh-in (with none left: `GET me/weight-logs/latest`, the starting
 * weight) and reloading the goal.
 *
 * The API allows one weigh-in per calendar day: `add()` on a day that has one answers
 * `{ kind: 'exists', id }` and changes nothing – the caller asks, and overwrites with `update()`.
 */
@Injectable({ providedIn: 'root' })
export class WeightLogService implements SessionDataStore {
  private readonly http = inject(HttpClient);
  private readonly url = injectApiUrl();
  private readonly now = inject(NOW);
  private readonly profiles = inject(UserProfileService);
  private readonly t = injectTranslate();
  private readonly entriesState = signal<readonly WeighEntry[]>([]);
  private readonly statusState = signal<StoreStatus>('idle');

  readonly status: Signal<StoreStatus> = this.statusState.asReadonly();
  readonly entries: Signal<readonly WeighEntry[]> = this.entriesState.asReadonly();
  readonly latest: Signal<WeighEntry | null> = computed(() => this.entriesState()[0] ?? null);

  /**
   * Every weigh-in, page by page (one GET until the user has more than 100). Never errors – a
   * failure sets `status` to `'error'`; "Prøv igen" calls this again.
   */
  load(): Observable<void> {
    return defer(() => {
      this.statusState.set('loading');
      return fetchAllPages((cursor) =>
        this.http.get<CursorPage<WeightLogDto>>(this.url(WEIGHT_ENDPOINT.LOGS), {
          params:
            cursor === null
              ? { limit: WEIGHT_LOG_LOAD_LIMIT }
              : { limit: WEIGHT_LOG_LOAD_LIMIT, cursor },
        }),
      );
    }).pipe(
      map((items) => {
        this.entriesState.set(sortNewestFirst(items.map(toWeighEntry)));
        this.statusState.set('ready');
      }),
      catchError(() => {
        this.statusState.set('error');
        return of(undefined);
      }),
    );
  }

  /** Forgets the account's weigh-ins – memory only. */
  reset(): void {
    this.entriesState.set([]);
    this.statusState.set('idle');
  }

  /**
   * Records a weigh-in now. `{ kind: 'exists', id }` when the day already has one (409 with
   * `existingWeightLogId`) – nothing changes then. Other failures are an `ApiError`.
   */
  add(kg: number): Observable<WeightSaveResult> {
    const request: CreateWeightLogRequest = {
      weight: roundTo(kg, 1),
      recordedAt: this.now().toISOString(),
    };
    return this.http.post<WeightLogDto>(this.url(WEIGHT_ENDPOINT.LOGS), request).pipe(
      switchMap((dto) => this.commit(dto)),
      map((entry): WeightSaveResult => ({ kind: 'saved', entry })),
      // Only the POST fails with an `HttpErrorResponse` here – `commit` maps its own errors.
      catchError((error: unknown) => {
        const id =
          error instanceof HttpErrorResponse && error.status === HttpStatusCode.Conflict
            ? readProblemBody(error)['existingWeightLogId']
            : undefined;
        return typeof id === 'number'
          ? of<WeightSaveResult>({ kind: 'exists', id: String(id) })
          : throwError(() => toApiError(error));
      }),
    );
  }

  /** Corrects a weigh-in's weight – and its time when `at` is given (overwriting today's). */
  update(id: string, kg: number, at?: Date): Observable<WeighEntry> {
    const request: UpdateWeightLogRequest = {
      weight: roundTo(kg, 1),
      recordedAt: at?.toISOString(),
    };
    return this.http.patch<WeightLogDto>(this.url(`${WEIGHT_ENDPOINT.LOGS}/${id}`), request).pipe(
      mapApiError(),
      switchMap((dto) => this.commit(dto)),
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`${WEIGHT_ENDPOINT.LOGS}/${id}`)).pipe(
      mapApiError(),
      switchMap(() => {
        this.entriesState.update((entries) => entries.filter((entry) => entry.id !== id));
        return this.syncProfile();
      }),
    );
  }

  /** The weigh-ins within the range, newest first. */
  entriesWithin(range: WeightRange): readonly WeighEntry[] {
    const from = this.rangeStart(range);
    return this.entriesState().filter((entry) => new Date(entry.at).getTime() >= from);
  }

  /**
   * The chart's points: the weigh-ins within the range, oldest first, each placed by its time on
   * the range's axis (`position` 0 = the range's start, 1 = now). Empty until the user has
   * weighed in.
   */
  seriesFor(range: WeightRange): readonly WeightPoint[] {
    const from = this.rangeStart(range);
    const span = this.now().getTime() - from;
    return this.entriesWithin(range)
      .map((entry) => ({
        kg: entry.kg,
        at: entry.at,
        // A weigh-in timed after now (another device's clock) sits at "now".
        position: Math.min(1, (new Date(entry.at).getTime() - from) / span),
      }))
      .reverse();
  }

  rangeLabel(range: WeightRange): string {
    return this.t(WEIGHT_RANGE_LABEL_KEY[range]);
  }

  /** The range's start in ms: the same time of day, `WEIGHT_RANGE_DAYS` calendar days back. */
  private rangeStart(range: WeightRange): number {
    return addDays(this.now(), -WEIGHT_RANGE_DAYS[range]).getTime();
  }

  /** Puts the API's weigh-in into the list (replacing the one with its id) and syncs the profile. */
  private commit(dto: WeightLogDto): Observable<WeighEntry> {
    const entry = toWeighEntry(dto);
    this.entriesState.update((entries) =>
      sortNewestFirst([entry, ...entries.filter((existing) => existing.id !== entry.id)]),
    );
    return this.syncProfile().pipe(map(() => entry));
  }

  /**
   * The profile's weight follows the newest weigh-in – or, with none left, the API's latest (the
   * starting weight). Then the goal the API recalculated is reloaded.
   */
  private syncProfile(): Observable<void> {
    const latest = this.latest();
    const weightKg =
      latest === null
        ? this.http
            .get<LatestWeightDto>(this.url(PROFILE_ENDPOINT.LATEST_WEIGHT))
            .pipe(map((dto) => dto.weight))
        : of(latest.kg);
    return weightKg.pipe(
      map((kg) => this.profiles.update({ weightKg: kg })),
      switchMap(() => this.profiles.reloadGoal()),
      mapApiError(),
    );
  }
}

function toWeighEntry(dto: WeightLogDto): WeighEntry {
  return {
    id: String(dto.weightLogId),
    kg: dto.weight,
    at: parseApiDateTime(dto.recordedAt).toISOString(),
  };
}

function sortNewestFirst(entries: readonly WeighEntry[]): readonly WeighEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
