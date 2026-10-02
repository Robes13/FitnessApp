import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../models/api-error';
import { LatestWeightDto } from '../../models/profile-api';
import { WeightSaveResult } from '../../models/weight';
import { TEST_GOAL, flushTestWeighIns, weightLogDto } from '../../testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../testing/test-providers';
import { UserProfileService } from '../user-profile/user-profile';
import { WeightLogService } from './weight-log';

const LOGS_URL = '/api/v1/me/weight-logs';
const GOAL_URL = '/api/v1/me/goals/current';

describe('WeightLogService', () => {
  let http: HttpTestingController;

  function setup(): WeightLogService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(WeightLogService);
  }

  /** The API recalculated the goal on the mutation – the store reloads it. */
  function flushGoal(): void {
    http.expectOne({ method: 'GET', url: GOAL_URL }).flush(TEST_GOAL);
  }

  function conflict(request: TestRequest, body: object | string): void {
    request.flush(body, { status: 409, statusText: 'Conflict' });
  }

  afterEach(() => http.verify());

  describe('load', () => {
    it('fetches the list – not the latest weight – with a single GET, newest first', async () => {
      const service = setup();
      const profile = TestBed.inject(UserProfileService);
      profile.update({ weightKg: 80 });

      const done = firstValueFrom(service.load());
      expect(service.status()).toBe('loading');
      http.expectOne({ method: 'GET', url: `${LOGS_URL}?limit=100` }).flush({
        items: [weightLogDto(2, 76, 8, TEST_NOW), weightLogDto(1, 74, 1, TEST_NOW)],
        nextCursor: null,
        hasMore: false,
      });
      await done;

      expect(service.status()).toBe('ready');
      expect(service.entries().map((entry) => entry.id)).toEqual(['1', '2']);
      expect(service.latest()?.kg).toBe(74);
      expect(profile.profile().weightKg).toBe(80);
    });

    it('follows nextCursor, so the very first weigh-in is loaded too', async () => {
      const service = setup();

      const done = firstValueFrom(service.load());
      http.expectOne(`${LOGS_URL}?limit=100`).flush({
        items: [weightLogDto(3, 74, 1, TEST_NOW)],
        nextCursor: 'more',
        hasMore: true,
      });
      http.expectOne(`${LOGS_URL}?limit=100&cursor=more`).flush({
        items: [weightLogDto(1, 80, 200, TEST_NOW)],
        nextCursor: null,
        hasMore: false,
      });
      await done;

      expect(service.status()).toBe('ready');
      expect(service.entries().map((entry) => entry.id)).toEqual(['3', '1']);
    });

    it('reads the API timestamps with seven fraction digits', async () => {
      const service = setup();

      const done = firstValueFrom(service.load());
      http.expectOne(`${LOGS_URL}?limit=100`).flush({
        items: [
          { ...weightLogDto(1, 74, 0, TEST_NOW), recordedAt: '2026-09-21T08:30:00.1234567Z' },
        ],
        nextCursor: null,
        hasMore: false,
      });
      await done;

      expect(service.latest()?.at).toBe('2026-09-21T08:30:00.123Z');
    });

    it('sets status error instead of throwing when the list fails', async () => {
      const service = setup();

      const done = firstValueFrom(service.load());
      http
        .expectOne(`${LOGS_URL}?limit=100`)
        .flush(null, { status: 500, statusText: 'Server Error' });

      await expect(done).resolves.toBeUndefined();
      expect(service.status()).toBe('error');
      expect(service.entries()).toEqual([]);
    });

    it('forgets the weigh-ins on reset', () => {
      const service = setup();
      flushTestWeighIns([weightLogDto(1, 74, 0, TEST_NOW)]);

      service.reset();

      expect(service.entries()).toEqual([]);
      expect(service.status()).toBe('idle');
    });
  });

  describe('add', () => {
    it('POSTs the weight with now, syncs the profile weight and reloads the goal', async () => {
      const service = setup();
      const profile = TestBed.inject(UserProfileService);

      const result = firstValueFrom(service.add(74.24));
      const post = http.expectOne({ method: 'POST', url: LOGS_URL });
      expect(post.request.body).toEqual({ weight: 74.2, recordedAt: TEST_NOW.toISOString() });
      post.flush(weightLogDto(7, 74.2, 0, TEST_NOW));
      flushGoal();

      expect(await result).toEqual<WeightSaveResult>({
        kind: 'saved',
        entry: { id: '7', kg: 74.2, at: TEST_NOW.toISOString() },
      });
      expect(service.weighedToday()).toBe(true);
      expect(profile.profile().weightKg).toBe(74.2);
      expect(profile.targets().kcal).toBe(2500);
    });

    it('answers "exists" on 409 with existingWeightLogId and sends no PATCH', async () => {
      const service = setup();
      flushTestWeighIns([weightLogDto(42, 75, 0, TEST_NOW)]);

      const result = firstValueFrom(service.add(74));
      conflict(http.expectOne({ method: 'POST', url: LOGS_URL }), {
        title: 'Conflict',
        status: 409,
        detail: 'A weight entry already exists for this calendar day.',
        existingWeightLogId: 42,
      });

      expect(await result).toEqual<WeightSaveResult>({ kind: 'exists', id: '42' });
      expect(service.latest()?.kg).toBe(75);
      // `verify()` in `afterEach` fails on any PATCH or goal reload.
    });

    it('reads existingWeightLogId from a string body (CapacitorHttp)', async () => {
      const service = setup();

      const result = firstValueFrom(service.add(74));
      conflict(
        http.expectOne({ method: 'POST', url: LOGS_URL }),
        JSON.stringify({ title: 'Conflict', status: 409, existingWeightLogId: 42 }),
      );

      expect(await result).toEqual<WeightSaveResult>({ kind: 'exists', id: '42' });
    });

    it('fails with an ApiError on any other error', async () => {
      const service = setup();

      const result = firstValueFrom(service.add(74));
      http.expectOne(LOGS_URL).error(new ProgressEvent('error'));

      const network: ApiError = { messageKey: 'common.error.network', status: 0 };
      await expect(result).rejects.toEqual(network);
      expect(service.entries()).toEqual([]);
    });
  });

  describe('update and remove', () => {
    function seeded(): WeightLogService {
      const service = setup();
      flushTestWeighIns([weightLogDto(1, 74, 1, TEST_NOW), weightLogDto(2, 76, 8, TEST_NOW)]);
      return service;
    }

    it('PATCHes weight and time and follows the newest weigh-in', async () => {
      const service = seeded();
      const profile = TestBed.inject(UserProfileService);

      const result = firstValueFrom(service.update('1', 73.46, TEST_NOW));
      const patch = http.expectOne({ method: 'PATCH', url: `${LOGS_URL}/1` });
      expect(patch.request.body).toEqual({ weight: 73.5, recordedAt: TEST_NOW.toISOString() });
      patch.flush(weightLogDto(1, 73.5, 0, TEST_NOW));
      flushGoal();

      expect((await result).kg).toBe(73.5);
      expect(service.entries().map((entry) => entry.kg)).toEqual([73.5, 76]);
      expect(service.weighedToday()).toBe(true);
      expect(profile.profile().weightKg).toBe(73.5);
    });

    it('keeps the time without `at`; an older weigh-in leaves the weight at the newest', async () => {
      const service = seeded();
      const profile = TestBed.inject(UserProfileService);

      const result = firstValueFrom(service.update('2', 80));
      const patch = http.expectOne({ method: 'PATCH', url: `${LOGS_URL}/2` });
      expect(patch.request.body).toEqual({ weight: 80 });
      patch.flush(weightLogDto(2, 80, 8, TEST_NOW));
      flushGoal();
      await result;

      expect(service.entries().map((entry) => entry.kg)).toEqual([74, 80]);
      expect(profile.profile().weightKg).toBe(74);
    });

    it('DELETEs and falls back to the previous weigh-in', async () => {
      const service = seeded();

      const done = firstValueFrom(service.remove('1'), { defaultValue: undefined });
      http
        .expectOne({ method: 'DELETE', url: `${LOGS_URL}/1` })
        .flush(null, { status: 204, statusText: 'No Content' });
      flushGoal();
      await done;

      expect(service.latest()?.id).toBe('2');
      expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(76);
    });

    it('GETs the latest weight – the starting weight – when the last weigh-in is deleted', async () => {
      const service = setup();
      flushTestWeighIns([weightLogDto(1, 72.3, 0, TEST_NOW)]);
      const latest: LatestWeightDto = {
        weightLogId: null,
        weight: 81,
        recordedAt: '2026-09-01T07:55:00Z',
        isStartingWeight: true,
      };

      const done = firstValueFrom(service.remove('1'), { defaultValue: undefined });
      http.expectOne(`${LOGS_URL}/1`).flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne({ method: 'GET', url: `${LOGS_URL}/latest` }).flush(latest);
      flushGoal();
      await done;

      expect(service.entries()).toEqual([]);
      expect(service.weighedToday()).toBe(false);
      expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(81);
    });

    it('changes nothing when the API refuses', async () => {
      const service = seeded();

      const done = firstValueFrom(service.remove('1'));
      http.expectOne(`${LOGS_URL}/1`).flush(null, { status: 404, statusText: 'Not Found' });

      await expect(done).rejects.toMatchObject({ status: 404 });
      expect(service.entries()).toHaveLength(2);
    });
  });

  it('lists the weigh-ins within a range newest first', () => {
    const service = setup();
    flushTestWeighIns([
      weightLogDto(2, 75, 60, TEST_NOW),
      weightLogDto(3, 74, 2, TEST_NOW),
      weightLogDto(1, 76, 120, TEST_NOW),
    ]);

    expect(service.entriesWithin('3m').map((entry) => entry.id)).toEqual(['3', '2']);
  });

  describe('seriesFor', () => {
    it('is empty without weighings', () => {
      const service = setup();

      expect(service.seriesFor('3u')).toEqual([]);
    });

    it('returns the weighings inside the range, oldest first – 3 weeks are 21 days', () => {
      const service = setup();
      flushTestWeighIns([
        weightLogDto(4, 74, 2, TEST_NOW),
        weightLogDto(3, 75, 10, TEST_NOW),
        weightLogDto(2, 75.5, 21, TEST_NOW),
        weightLogDto(1, 76, 22, TEST_NOW),
      ]);

      expect(service.seriesFor('3u').map((point) => point.kg)).toEqual([75.5, 75, 74]);
      expect(service.seriesFor('1u').map((point) => point.kg)).toEqual([74]);
      expect(service.seriesFor('3m').map((point) => point.kg)).toEqual([76, 75.5, 75, 74]);
    });

    it('places each weighing by its time in the range: 0 = the start, 1 = now', () => {
      const service = setup();
      flushTestWeighIns([
        weightLogDto(3, 74, 0, TEST_NOW),
        weightLogDto(2, 75, 2, TEST_NOW),
        weightLogDto(1, 75.5, 5, TEST_NOW),
      ]);

      const positions = service.seriesFor('1u').map((point) => point.position);
      expect(positions).toHaveLength(3);
      expect(positions[0]).toBeCloseTo(2 / 7, 2);
      expect(positions[1]).toBeCloseTo(5 / 7, 2);
      expect(positions[2]).toBe(1);
    });
  });

  it('labels ranges in Danish', () => {
    const service = setup();

    expect(service.rangeLabel('1u')).toBe('Sidste uge');
    expect(service.rangeLabel('3u')).toBe('Sidste 3 uger');
    expect(service.rangeLabel('3m')).toBe('Sidste 3 mdr.');
  });
});
