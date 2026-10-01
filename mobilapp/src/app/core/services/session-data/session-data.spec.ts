import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { STORAGE_KEY } from '../../constants/storage-key';
import { SessionState } from '../../models/session';
import { createFakeStorage } from '../../testing/fake-document';
import { AUTHENTICATED_SESSION, TEST_AUTH_RESPONSE } from '../../testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../testing/test-providers';
import { BarcodeScannerService } from '../barcode-scanner/barcode-scanner';
import { CollectionsService } from '../collections/collections';
import { FoodLogService } from '../food-log/food-log';
import { SessionService } from '../session/session';
import { UserProfileService } from '../user-profile/user-profile';
import { WeightLogService } from '../weight-log/weight-log';
import { SESSION_DATA_STORES, SessionDataService, SessionDataStore } from './session-data';

class FakeStore implements SessionDataStore {
  loads = 0;
  cancelled = 0;
  resets = 0;

  /** Never completes, so the test can see a running load being cancelled. */
  load(): Observable<void> {
    this.loads += 1;
    return new Observable<void>(() => () => {
      this.cancelled += 1;
    });
  }

  reset(): void {
    this.resets += 1;
  }
}

describe('SessionDataService', () => {
  function setup(session: SessionState | null) {
    const store = new FakeStore();
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment({
          storage: createFakeStorage(session === null ? {} : { [STORAGE_KEY.SESSION]: session }),
        }),
        provideRouter([]),
        { provide: SESSION_DATA_STORES, useValue: [store] },
      ],
    });
    TestBed.inject(SessionDataService);
    TestBed.tick();
    return { store, session: TestBed.inject(SessionService) };
  }

  it('loads every store for a restored authenticated session', () => {
    const { store } = setup(AUTHENTICATED_SESSION);

    expect(store.loads).toBe(1);
    expect(store.resets).toBe(0);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('neither loads nor resets while the e-mail is unverified', async () => {
    const { store, session } = setup(null);
    // Once for the guest at start-up.
    expect(store.resets).toBe(1);

    const login = firstValueFrom(session.login('mads', 'hemmelig1234'));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush({ title: 'Forbidden', status: 403 }, { status: 403, statusText: 'Forbidden' });
    await login;
    TestBed.tick();

    expect(session.status()).toBe('pending-verification');
    expect(store.loads).toBe(0);
    expect(store.resets).toBe(1);
  });

  it('neither cancels nor restarts the loads when the tokens are refreshed', async () => {
    const { store, session } = setup({
      ...AUTHENTICATED_SESSION,
      tokens: {
        ...AUTHENTICATED_SESSION.tokens!,
        accessTokenExpiresAt: new Date(TEST_NOW.getTime() + 30_000).toISOString(),
      },
    });
    expect(store.loads).toBe(1);

    const refresh = firstValueFrom(session.refresh());
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/refresh')
      .flush(TEST_AUTH_RESPONSE);
    await refresh;
    TestBed.tick();

    expect(session.isAuthenticated()).toBe(true);
    expect(store.loads).toBe(1);
    expect(store.cancelled).toBe(0);
  });

  it('loads after login and resets after log out', async () => {
    const { store, session } = setup(null);
    const http = TestBed.inject(HttpTestingController);
    expect(store.loads).toBe(0);

    const login = firstValueFrom(session.login('mads@nutrify.dk', 'hemmelig1234'));
    http.expectOne('/api/v1/auth/login').flush(TEST_AUTH_RESPONSE);
    await login;
    TestBed.tick();
    expect(store.loads).toBe(1);

    const logout = firstValueFrom(session.logout());
    http.expectOne('/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    TestBed.tick();

    // Once for the guest at start-up, once after log out – and the running load was cancelled.
    expect(store.resets).toBe(2);
    expect(store.loads).toBe(1);
    expect(store.cancelled).toBe(1);
  });

  it('registers the profile, weight, food, collections and scan count stores by default', () => {
    TestBed.configureTestingModule({
      providers: [...provideCoreTestEnvironment(), provideRouter([])],
    });

    const stores = TestBed.inject(SESSION_DATA_STORES);

    expect(stores).toHaveLength(5);
    expect(stores[0]).toBe(TestBed.inject(UserProfileService));
    expect(stores[1]).toBe(TestBed.inject(WeightLogService));
    expect(stores[2]).toBe(TestBed.inject(FoodLogService));
    expect(stores[3]).toBe(TestBed.inject(CollectionsService));
    expect(stores[4]).toBe(TestBed.inject(BarcodeScannerService));
  });
});
