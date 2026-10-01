import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { STORAGE_KEY } from '../../constants/storage-key';
import { CursorPage } from '../../models/api';
import { UserProfileDto } from '../../models/profile-api';
import {
  ApiConsentType,
  HealthPlatform,
  HealthSource,
  StepSyncRecord,
  UserConsentDto,
} from '../../models/step-sync';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { TEST_AUTH_RESPONSE, TEST_GOAL } from '../../testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../testing/test-providers';
import { addDays, startOfDay } from '../../utils/date-format';
import { UserProfileService } from '../user-profile/user-profile';
import { HEALTH_PLATFORM } from './health-platform';
import { StepSyncService } from './step-sync';

const CONSENTS = '/api/v1/me/consents';
const CONSENTS_PAGE = `${CONSENTS}?limit=50`;
const WITHDRAW = '/api/v1/me/consents/StepsIntegration/withdraw';
const ACTIVITY = '/api/v1/me/profile/activity';
const CURRENT_GOAL = '/api/v1/me/goals/current';
/** Seven days with steps – the least that counts – averaging 7432.43. */
const WEEK_OF_STEPS: readonly number[] = [6000, 8000, 7000, 9027, 5000, 8000, 9000];

class FakeHealthPlatform implements HealthPlatform {
  available = true;
  access = true;
  accessAfterRequest = true;
  totals: readonly number[] | Error = WEEK_OF_STEPS;
  requests = 0;
  readonly ranges: { from: Date; to: Date }[] = [];

  source(): HealthSource {
    return 'health-connect';
  }
  async isAvailable(): Promise<boolean> {
    return this.available;
  }
  async requestStepsAccess(): Promise<boolean> {
    this.requests += 1;
    return this.accessAfterRequest;
  }
  async hasStepsAccess(): Promise<boolean> {
    return this.access;
  }
  async dailyStepTotals(from: Date, to: Date): Promise<readonly number[]> {
    this.ranges.push({ from, to });
    if (this.totals instanceof Error) {
      throw this.totals;
    }
    return this.totals;
  }
}

function consent(type: ApiConsentType, withdrawnAt: string | null = null): UserConsentDto {
  return {
    userConsentId: 1,
    consentType: type,
    documentVersion: '1',
    grantedAt: '2026-09-01T08:00:00Z',
    withdrawnAt,
  };
}

function page(items: UserConsentDto[]): CursorPage<UserConsentDto> {
  return { items, nextCursor: null, hasMore: false };
}

const PROFILE_DTO: UserProfileDto = {
  userProfileId: 3,
  userId: 1,
  birthDate: '1998-05-16',
  gender: 'Male',
  height: 180,
  startingWeight: 80,
  dailySteps: 7432,
  trainingDaysPerWeek: 3,
  workoutDurationMinutes: 45,
  trainingIntensity: 'Moderate',
  timeZoneId: 'Europe/Copenhagen',
  profileImageUrl: null,
};

/** Lets the plugin's promises (and what they start) run. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

describe('StepSyncService', () => {
  let storage: FakeStorage;
  let platform: FakeHealthPlatform;

  beforeEach(() => {
    storage = createFakeStorage();
    platform = new FakeHealthPlatform();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup(): { service: StepSyncService; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment({ storage }),
        { provide: HEALTH_PLATFORM, useValue: platform },
      ],
    });
    const service = TestBed.inject(StepSyncService);
    // Runs the effect behind `toObservable(profile.status)`.
    TestBed.tick();
    return { service, http: TestBed.inject(HttpTestingController) };
  }

  function storeLastSync(daysAgo: number, dailySteps = 6000): StepSyncRecord {
    const record = { syncedAt: addDays(TEST_NOW, -daysAgo).toISOString(), dailySteps };
    storage.setItem(STORAGE_KEY.STEP_SYNC, JSON.stringify(record));
    return record;
  }

  function storedLastSync(): StepSyncRecord | null {
    const raw = storage.getItem(STORAGE_KEY.STEP_SYNC);
    return raw === null ? null : (JSON.parse(raw) as StepSyncRecord);
  }

  /**
   * Starts `load()`, answers the consent read and lets the sync reach its first request. The
   * load's own promise is wrapped – an async function would otherwise wait for it.
   */
  async function load(
    service: StepSyncService,
    consents: UserConsentDto[] = [consent('StepsIntegration'), consent('Terms')],
  ): Promise<{ done: Promise<void> }> {
    const done = firstValueFrom(service.load());
    await settle();
    TestBed.inject(HttpTestingController).expectOne(CONSENTS_PAGE).flush(page(consents));
    await settle();
    return { done };
  }

  /** Answers the PUT with the steps it sent and the goal reload with `TEST_GOAL`. */
  function answerSync(http: HttpTestingController): TestRequest {
    const put = http.expectOne(ACTIVITY);
    put.flush({ ...PROFILE_DTO, dailySteps: put.request.body.dailySteps });
    http.expectOne(CURRENT_GOAL).flush(TEST_GOAL);
    return put;
  }

  it('is unavailable in the browser and fetches nothing', async () => {
    platform.available = false;
    const { service } = setup();

    await firstValueFrom(service.load());

    expect(service.available()).toBe(false);
    expect(service.enabled()).toBe(false);
    expect(service.status()).toBe('ready');
  });

  it('is off without an active StepsIntegration consent, and then never syncs', async () => {
    const { service } = setup();

    await (
      await load(service, [consent('StepsIntegration', '2026-09-10T08:00:00Z')])
    ).done;

    expect(service.available()).toBe(true);
    expect(service.enabled()).toBe(false);
    expect(service.status()).toBe('ready');
    expect(platform.ranges).toHaveLength(0);
  });

  it('sends the rounded average of the last 30 full days and shows the new steps and goal', async () => {
    const { service, http } = setup();
    const profiles = TestBed.inject(UserProfileService);

    const { done } = await load(service);
    const put = answerSync(http);
    await done;

    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ dailySteps: 7432, fromHealthIntegration: true });
    const today = startOfDay(TEST_NOW);
    expect(platform.ranges).toEqual([{ from: addDays(today, -30), to: today }]);
    expect(profiles.profile().stepsPerDay).toBe(7432);
    expect(profiles.goal()).toEqual(TEST_GOAL);
    expect(service.status()).toBe('synced');
    expect(service.lastSync()).toEqual({ syncedAt: TEST_NOW.toISOString(), dailySteps: 7432 });
    expect(storedLastSync()).toEqual(service.lastSync());
  });

  it('averages only the days that have steps', async () => {
    platform.totals = [0, ...WEEK_OF_STEPS, 0, 0];
    const { service, http } = setup();

    const { done } = await load(service);
    const put = answerSync(http);
    await done;

    expect(put.request.body.dailySteps).toBe(7432);
  });

  it('is not due within 30 days of the last sync', async () => {
    const record = storeLastSync(29);
    const { service } = setup();

    await (
      await load(service)
    ).done;

    expect(service.status()).toBe('ready');
    expect(service.lastSync()).toEqual(record);
    expect(platform.ranges).toHaveLength(0);
  });

  it('is due again 30 days after the last sync', async () => {
    storeLastSync(30);
    const { service, http } = setup();

    const { done } = await load(service);
    answerSync(http);
    await done;

    expect(service.status()).toBe('synced');
  });

  it('2.6-4a: without access to steps nothing is fetched or sent', async () => {
    platform.access = false;
    const { service } = setup();

    await (
      await load(service)
    ).done;

    expect(service.status()).toBe('no-permission');
    expect(platform.ranges).toHaveLength(0);
    expect(storedLastSync()).toBeNull();
  });

  it('2.6-3a: fewer than 7 days with steps changes nothing', async () => {
    platform.totals = [0, 0, ...WEEK_OF_STEPS.slice(1)];
    const { service } = setup();

    await (
      await load(service)
    ).done;

    expect(service.status()).toBe('insufficient');
    expect(storedLastSync()).toBeNull();
  });

  it('2.6-3b: a failing health store keeps the old sync date, so it is tried again', async () => {
    const record = storeLastSync(31);
    platform.totals = new Error('Health Connect is unavailable');
    const { service } = setup();

    await (
      await load(service)
    ).done;

    expect(service.status()).toBe('failed');
    expect(service.lastSync()).toEqual(record);
    expect(storedLastSync()).toEqual(record);
  });

  it('2.6-3b: a failing API keeps the old sync date as well', async () => {
    const record = storeLastSync(31);
    const { service, http } = setup();

    const { done } = await load(service);
    http.expectOne(ACTIVITY).flush(null, { status: 500, statusText: 'Server Error' });
    await done;

    expect(service.status()).toBe('failed');
    expect(storedLastSync()).toEqual(record);
  });

  it('waits for the profile to load, so its older answer cannot overwrite the sync', async () => {
    const { service, http } = setup();
    const profiles = TestBed.inject(UserProfileService);
    profiles.load().subscribe();
    TestBed.tick();

    const { done } = await load(service);
    http.expectNone(ACTIVITY);

    http.expectOne('/api/v1/me').flush(TEST_AUTH_RESPONSE.user);
    http.expectOne('/api/v1/me/profile').flush({ ...PROFILE_DTO, dailySteps: 3000 });
    http.expectOne('/api/v1/me/goals/recalculate').flush(TEST_GOAL);
    http.expectOne('/api/v1/me/settings').flush([]);
    http
      .expectOne('/api/v1/me/weight-logs/latest')
      .flush({ weightLogId: null, weight: 80, recordedAt: '', isStartingWeight: true });
    TestBed.tick();
    await settle();
    answerSync(http);
    await done;

    expect(profiles.profile().stepsPerDay).toBe(7432);
  });

  it('a failed consent read is an error status, not an error', async () => {
    const { service, http } = setup();

    const done = firstValueFrom(service.load());
    await settle();
    http.expectOne(CONSENTS_PAGE).flush(null, { status: 500, statusText: 'Server Error' });
    await done;

    expect(service.status()).toBe('error');
    expect(service.enabled()).toBe(false);
  });

  it('enable: asks for access, grants the consent (409 = already active) and syncs at once', async () => {
    storeLastSync(1);
    const { service, http } = setup();

    const enabled = firstValueFrom(service.enable());
    await settle();
    const grant = http.expectOne(CONSENTS);
    expect(grant.request.method).toBe('POST');
    expect(grant.request.body).toEqual({ consentType: 'StepsIntegration', documentVersion: '1' });
    grant.flush(
      { title: 'Conflict', status: 409, detail: 'This consent is already active.' },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();
    answerSync(http);

    await expect(enabled).resolves.toBe(true);
    expect(platform.requests).toBe(1);
    expect(service.enabled()).toBe(true);
    expect(service.status()).toBe('synced');
  });

  it('enable: denied access grants nothing and stays off', async () => {
    platform.accessAfterRequest = false;
    const { service } = setup();

    await expect(firstValueFrom(service.enable())).resolves.toBe(false);

    expect(service.enabled()).toBe(false);
  });

  it('enable: a failed consent is an ApiError, and it stays off', async () => {
    const { service, http } = setup();

    const enabled = firstValueFrom(service.enable());
    await settle();
    http.expectOne(CONSENTS).flush(null, { status: 500, statusText: 'Server Error' });

    await expect(enabled).rejects.toEqual({ messageKey: 'common.error.server', status: 500 });
    expect(service.enabled()).toBe(false);
  });

  it('disable (9.2-3a): withdraws the consent, 404 = already gone, and stops the syncs', async () => {
    storeLastSync(1);
    const { service, http } = setup();
    await (
      await load(service)
    ).done;
    expect(service.enabled()).toBe(true);

    const disabled = firstValueFrom(service.disable());
    const withdraw = http.expectOne(WITHDRAW);
    expect(withdraw.request.method).toBe('POST');
    withdraw.flush(null, { status: 404, statusText: 'Not Found' });
    await disabled;

    expect(service.enabled()).toBe(false);
    expect(service.status()).toBe('ready');
  });

  it('disable: a failed withdrawal is an ApiError, and it stays on', async () => {
    const { service, http } = setup();
    storeLastSync(1);
    await (
      await load(service)
    ).done;

    const disabled = firstValueFrom(service.disable());
    http.expectOne(WITHDRAW).flush(null, { status: 500, statusText: 'Server Error' });

    await expect(disabled).rejects.toEqual({ messageKey: 'common.error.server', status: 500 });
    expect(service.enabled()).toBe(true);
  });

  it('reset forgets the account in memory only', async () => {
    const record = storeLastSync(1);
    const { service } = setup();
    await (
      await load(service)
    ).done;

    service.reset();

    expect(service.available()).toBe(false);
    expect(service.enabled()).toBe(false);
    expect(service.status()).toBe('idle');
    expect(service.lastSync()).toBeNull();
    expect(storedLastSync()).toEqual(record);
  });
});
