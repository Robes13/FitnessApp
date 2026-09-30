import { Injectable, InjectionToken, effect, inject, untracked } from '@angular/core';
import { Observable } from 'rxjs';
import { CollectionsService } from '../collections/collections';
import { FoodLogService } from '../food-log/food-log';
import { SessionService } from '../session/session';
import { UserProfileService } from '../user-profile/user-profile';
import { WeightLogService } from '../weight-log/weight-log';

/** A store holding the signed-in user's data from the API. */
export interface SessionDataStore {
  /**
   * Fetches the user's data. Called when the session becomes `authenticated` – never from the
   * constructor. The store handles its own errors (e.g. a `status` signal), so it doesn't error.
   */
  load(): Observable<unknown>;
  /**
   * Forgets the data again when the session becomes `guest`. Only clears memory – it must never
   * write storage: logging out keeps the device's data, and after an account deletion storage
   * has just been cleared. Local-only data is therefore read in `load()`, not in the constructor.
   */
  reset(): void;
}

/**
 * The stores `SessionDataService` loads and resets. Add a domain's store by injecting it here.
 * `ReminderService` is deliberately not one: it is created after the language initializer.
 */
export const SESSION_DATA_STORES = new InjectionToken<readonly SessionDataStore[]>(
  'SESSION_DATA_STORES',
  {
    providedIn: 'root',
    factory: () => [
      inject(UserProfileService),
      inject(WeightLogService),
      inject(FoodLogService),
      inject(CollectionsService),
    ],
  },
);

/**
 * Loads every store in `SESSION_DATA_STORES` when the session becomes `authenticated` (also at
 * start-up with a restored session) and resets them when it becomes `guest`. Loads still running
 * when the status changes again are cancelled. Created by an app initializer.
 */
@Injectable({ providedIn: 'root' })
export class SessionDataService {
  private readonly session = inject(SessionService);
  private readonly stores = inject(SESSION_DATA_STORES);

  constructor() {
    effect((onCleanup) => {
      const status = this.session.status();
      untracked(() => {
        if (status === 'authenticated') {
          const loads = this.stores.map((store) => store.load().subscribe());
          onCleanup(() => loads.forEach((load) => load.unsubscribe()));
        } else if (status === 'guest') {
          this.stores.forEach((store) => store.reset());
        }
      });
    });
  }
}
