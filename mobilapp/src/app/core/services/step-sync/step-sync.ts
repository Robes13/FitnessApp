import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  defer,
  filter,
  finalize,
  from,
  map,
  of,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';
import { STEPS_MAX, STEPS_MIN } from '../../constants/nutrition';
import { PROFILE_ENDPOINT } from '../../constants/profile';
import {
  CONSENT_PAGE_LIMIT,
  STEPS_CONSENT_DOCUMENT_VERSION,
  STEPS_CONSENT_TYPE,
  STEP_SYNC_ENDPOINT,
  STEP_SYNC_INTERVAL_DAYS,
  STEP_SYNC_MIN_DAYS,
  STEP_SYNC_WINDOW_DAYS,
} from '../../constants/step-sync';
import { STORAGE_KEY } from '../../constants/storage-key';
import { CursorPage } from '../../models/api';
import { UserProfileDto } from '../../models/profile-api';
import {
  GrantConsentRequest,
  HealthSource,
  StepSyncRecord,
  StepSyncStatus,
  UpdateActivityRequest,
  UserConsentDto,
} from '../../models/step-sync';
import { injectApiUrl, toApiError } from '../../utils/api';
import { addDays, daysBetween, startOfDay } from '../../utils/date-format';
import { clamp } from '../../utils/math';
import { NOW } from '../../utils/now';
import { SessionDataStore } from '../session-data/session-data';
import { StorageService } from '../storage/storage';
import { UserProfileService } from '../user-profile/user-profile';
import { HEALTH_PLATFORM } from './health-platform';

/**
 * Spec 2.6 and 9.2-3a: the daily steps from Apple Health (iOS) or Health Connect (Android).
 *
 * A `SessionDataStore`: `load()` (app start, login) reads whether the `StepsIntegration` consent is
 * active and then syncs when one is due – at most once every 30 days per device, no scheduler. A
 * sync averages the steps of the last 28 full local days that have steps and sends it with
 * `PUT me/profile/activity`, which recalculates the goal; the profile then shows the new steps and
 * goal. Turning it on asks the health store for access, grants the consent and syncs right away;
 * turning it off withdraws the consent, and the activity level stays as it is (edited by hand,
 * spec 2.5).
 *
 * `load()` and the syncs never error: how they ended is `status`. A failed sync saves no date, so
 * the next load tries again. In the browser `available` is `false` and nothing is fetched.
 * Never injects `SessionService`.
 */
@Injectable({ providedIn: 'root' })
export class StepSyncService implements SessionDataStore {
  private readonly http = inject(HttpClient);
  private readonly url = injectApiUrl();
  private readonly storage = inject(StorageService);
  private readonly platform = inject(HEALTH_PLATFORM);
  private readonly profiles = inject(UserProfileService);
  private readonly now = inject(NOW);
  /**
   * Emits once the profile isn't loading. A sync waits for it: the profile's load runs in
   * parallel at start-up, and its older answer would otherwise overwrite the synced steps and goal.
   */
  private readonly profileSettled = toObservable(this.profiles.status).pipe(
    filter((status) => status !== 'loading'),
    take(1),
  );
  private readonly availableState = signal(false);
  private readonly enabledState = signal(false);
  private readonly statusState = signal<StepSyncStatus>('idle');
  private readonly lastSyncState = signal<StepSyncRecord | null>(null);

  /** Apple Health or Health Connect – `null` in the browser. */
  readonly source: HealthSource | null = this.platform.source();
  /** Health Connect has a settings screen the app can open (`openSettings`); Apple Health hasn't. */
  readonly canOpenSettings: boolean = this.source === 'health-connect';
  /** The device has the health store. `false` until loaded – the UI hides the feature then. */
  readonly available: Signal<boolean> = this.availableState.asReadonly();
  /** The `StepsIntegration` consent is active (spec 9.2). */
  readonly enabled: Signal<boolean> = this.enabledState.asReadonly();
  readonly status: Signal<StepSyncStatus> = this.statusState.asReadonly();
  /** The latest successful sync on this device. */
  readonly lastSync: Signal<StepSyncRecord | null> = this.lastSyncState.asReadonly();

  load(): Observable<void> {
    return defer(() => {
      this.statusState.set('loading');
      this.lastSyncState.set(this.storage.read<StepSyncRecord>(STORAGE_KEY.STEP_SYNC));
      return from(this.platform.isAvailable());
    }).pipe(
      switchMap((available) => {
        this.availableState.set(available);
        return available ? this.readConsent() : of(false);
      }),
      tap((enabled) => {
        this.enabledState.set(enabled);
        this.statusState.set('ready');
      }),
      switchMap(() => (this.isDue() ? this.sync() : of(undefined))),
      // Only the availability check and the consent get here – `sync()` never errors.
      catchError((error: unknown) => {
        console.warn('StepSyncService: samtykket kunne ikke hentes.', error);
        this.statusState.set('error');
        return of(undefined);
      }),
    );
  }

  /** Forgets the account's state – memory only (the sync date stays on the device). */
  reset(): void {
    this.availableState.set(false);
    this.enabledState.set(false);
    this.statusState.set('idle');
    this.lastSyncState.set(null);
  }

  /**
   * The user turns it on (or allows access again, 2.6-4a): asks the health store for read access
   * to steps, grants the consent (409 = already active = fine) and syncs right away. `false` when
   * access wasn't given – also when the consent is already active – and nothing changes then. A
   * failed consent is an `ApiError`; the sync's outcome is `status`.
   */
  enable(): Observable<boolean> {
    return defer(() => from(this.requestAccess())).pipe(
      switchMap((granted) =>
        granted
          ? this.grantConsent().pipe(
              switchMap(() => this.sync()),
              map(() => true),
            )
          : of(false),
      ),
    );
  }

  /**
   * 2.6-4a on Android: after two denials Health Connect stops showing its dialog, and access can
   * then only be allowed in its settings. A failure is only logged.
   */
  async openSettings(): Promise<void> {
    try {
      await this.platform.openSettings();
    } catch (error: unknown) {
      console.warn('StepSyncService: Health Connect kunne ikke åbnes.', error);
    }
  }

  /**
   * Spec 9.2-3a: withdraws the consent (404 = already gone = fine), which stops the automatic
   * syncs. The activity level stays as it is. Fails with an `ApiError`; nothing changes then.
   */
  disable(): Observable<void> {
    return this.http.post<void>(this.url(STEP_SYNC_ENDPOINT.WITHDRAW), null).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(undefined)
          : throwError(() => toApiError(error)),
      ),
      map(() => {
        this.enabledState.set(false);
        this.statusState.set('ready');
      }),
    );
  }

  /** The newest `StepsIntegration` row is the active one when it isn't withdrawn. */
  private readConsent(): Observable<boolean> {
    return this.http
      .get<CursorPage<UserConsentDto>>(this.url(STEP_SYNC_ENDPOINT.CONSENTS), {
        params: { limit: CONSENT_PAGE_LIMIT },
      })
      .pipe(
        map((page) =>
          page.items.some(
            (consent) => consent.consentType === STEPS_CONSENT_TYPE && consent.withdrawnAt === null,
          ),
        ),
      );
  }

  private grantConsent(): Observable<void> {
    const request: GrantConsentRequest = {
      consentType: STEPS_CONSENT_TYPE,
      documentVersion: STEPS_CONSENT_DOCUMENT_VERSION,
    };
    return this.http.post<UserConsentDto>(this.url(STEP_SYNC_ENDPOINT.CONSENTS), request).pipe(
      map(() => undefined),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.Conflict
          ? of(undefined)
          : throwError(() => toApiError(error)),
      ),
      tap(() => this.enabledState.set(true)),
    );
  }

  /** A failed permission dialog (e.g. Health Connect missing) counts as no access. */
  private async requestAccess(): Promise<boolean> {
    try {
      return await this.platform.requestStepsAccess();
    } catch (error: unknown) {
      console.warn('StepSyncService: adgangen til skridt kunne ikke gives.', error);
      return false;
    }
  }

  private isDue(): boolean {
    const last = this.lastSyncState();
    return (
      this.enabledState() &&
      this.availableState() &&
      (last === null || daysBetween(new Date(last.syncedAt), this.now()) >= STEP_SYNC_INTERVAL_DAYS)
    );
  }

  /** Never errors – the outcome is `status`. */
  private sync(): Observable<void> {
    return defer(() => {
      this.statusState.set('syncing');
      return this.profileSettled;
    }).pipe(
      switchMap(() => from(this.platform.hasStepsAccess())),
      switchMap((granted) => (granted ? this.syncSteps() : of<StepSyncStatus>('no-permission'))),
      map((status) => this.statusState.set(status)),
      catchError((error: unknown) => {
        // No step counts here: the error is the plugin's or the API's, never health data.
        console.warn('StepSyncService: skridtene kunne ikke hentes.', error);
        this.statusState.set('failed');
        return of(undefined);
      }),
      // Cancelled midway (log out, the profile page left): not stuck on "syncing".
      finalize(() =>
        this.statusState.update((status) => (status === 'syncing' ? 'ready' : status)),
      ),
    );
  }

  private syncSteps(): Observable<StepSyncStatus> {
    const today = startOfDay(this.now());
    return from(this.platform.dailyStepTotals(addDays(today, -STEP_SYNC_WINDOW_DAYS), today)).pipe(
      switchMap((totals) => {
        const days = totals.filter((steps) => steps > 0);
        if (days.length === 0 && this.source === 'apple-health') {
          // HealthKit never says whether reading was denied: a denied read just has no data.
          return of<StepSyncStatus>('no-steps');
        }
        if (days.length < STEP_SYNC_MIN_DAYS) {
          return of<StepSyncStatus>('insufficient');
        }
        const average = days.reduce((sum, steps) => sum + steps, 0) / days.length;
        return this.saveSteps(clamp(Math.round(average), STEPS_MIN, STEPS_MAX));
      }),
    );
  }

  /** Sends the average, shows it and the recalculated goal, and only then saves the date. */
  private saveSteps(dailySteps: number): Observable<StepSyncStatus> {
    const request: UpdateActivityRequest = { dailySteps, fromHealthIntegration: true };
    return this.http.put<UserProfileDto>(this.url(PROFILE_ENDPOINT.ACTIVITY), request).pipe(
      tap((dto) => this.profiles.update({ stepsPerDay: dto.dailySteps })),
      switchMap(() => this.profiles.reloadGoal()),
      map(() => {
        const record: StepSyncRecord = { syncedAt: this.now().toISOString(), dailySteps };
        this.storage.write(STORAGE_KEY.STEP_SYNC, record);
        this.lastSyncState.set(record);
        return 'synced';
      }),
    );
  }
}
