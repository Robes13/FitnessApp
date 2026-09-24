import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../../constants/storage-key';
import { WeighEntry } from '../../models/weight';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { TEST_NOW, provideCoreTestEnvironment } from '../../testing/test-providers';
import { UserProfileService } from '../user-profile/user-profile';
import { WeightLogService } from './weight-log';

const MS_PER_DAY = 86_400_000;

/** Same time of day as `TEST_NOW`, `days` days back. */
function isoDaysAgo(days: number): string {
  return new Date(TEST_NOW.getTime() - days * MS_PER_DAY).toISOString();
}

describe('WeightLogService', () => {
  let storage: FakeStorage;

  function setup(): WeightLogService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    return TestBed.inject(WeightLogService);
  }

  function daysAgo(entry: WeighEntry): number {
    return Math.round((TEST_NOW.getTime() - new Date(entry.at).getTime()) / MS_PER_DAY);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('starts empty on first run and writes nothing', () => {
    const service = setup();

    expect(service.entries()).toEqual([]);
    expect(service.latest()).toBeNull();
    expect(service.weighedToday()).toBe(false);
    expect(storage.getItem(STORAGE_KEY.WEIGHT_LOG)).toBeNull();
  });

  it('restores stored entries sorted newest first', () => {
    storage.setItem(
      STORAGE_KEY.WEIGHT_LOG,
      JSON.stringify([
        { id: 'a', kg: 80, at: '2026-09-01T08:00:00.000Z' },
        { id: 'b', kg: 79, at: '2026-09-10T08:00:00.000Z' },
      ]),
    );

    const service = setup();

    expect(service.entries().map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('adds a weighing, updates the profile and marks today as weighed', () => {
    const service = setup();
    const profile = TestBed.inject(UserProfileService);

    const entry = service.add(74.24);

    expect(entry.kg).toBe(74.2);
    expect(entry.at).toBe(TEST_NOW.toISOString());
    expect(service.latest()).toEqual(entry);
    expect(service.weighedToday()).toBe(true);
    expect(profile.profile().weightKg).toBe(74.2);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.WEIGHT_LOG) ?? '[]')).toHaveLength(1);
  });

  it('keeps entries ordered when adding a back-dated weighing', () => {
    const service = setup();

    service.add(75);
    service.add(77, new Date(2026, 8, 1));

    expect(service.entries().map(daysAgo)).toEqual([0, 20]);
  });

  it("updates today's weigh-in instead of adding a second one the same day", () => {
    const service = setup();
    const profile = TestBed.inject(UserProfileService);
    const first = service.add(75);

    const second = service.add(74.6, new Date(TEST_NOW.getTime() + 60_000));

    expect(service.entries()).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(service.latest()?.kg).toBe(74.6);
    expect(profile.profile().weightKg).toBe(74.6);
  });

  it('collapses every legacy weigh-in from the same day into one', () => {
    const earlier = new Date(TEST_NOW.getTime() - 60_000).toISOString();
    storage.setItem(
      STORAGE_KEY.WEIGHT_LOG,
      JSON.stringify([
        { id: 'weigh-a', kg: 75, at: TEST_NOW.toISOString() },
        { id: 'weigh-b', kg: 75.4, at: earlier },
        { id: 'weigh-old', kg: 76, at: isoDaysAgo(3) },
      ]),
    );
    const service = setup();

    const entry = service.add(74.8, new Date(TEST_NOW.getTime() + 60_000));

    expect(service.entries().map((existing) => existing.id)).toEqual([entry.id, 'weigh-old']);
    expect(entry.id).toBe('weigh-a');
  });

  it('does not let a back-dated weighing overwrite the profile weight', () => {
    const service = setup();
    const profile = TestBed.inject(UserProfileService);

    service.add(75);
    service.add(77, new Date(2026, 8, 1));

    expect(profile.profile().weightKg).toBe(75);
  });

  describe('update and remove', () => {
    function seeded(): WeightLogService {
      storage.setItem(
        STORAGE_KEY.WEIGHT_LOG,
        JSON.stringify([
          { id: 'new', kg: 74, at: isoDaysAgo(1) },
          { id: 'old', kg: 76, at: isoDaysAgo(8) },
        ]),
      );
      return setup();
    }

    it('corrects the latest weigh-in and syncs the profile weight', () => {
      const service = seeded();

      const updated = service.update('new', 73.46);

      expect(updated).toEqual({ id: 'new', kg: 73.5, at: isoDaysAgo(1) });
      expect(service.latest()?.kg).toBe(73.5);
      expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(73.5);
      expect(JSON.parse(storage.getItem(STORAGE_KEY.WEIGHT_LOG) ?? '[]')[0].kg).toBe(73.5);
    });

    it('corrects an older weigh-in without touching the profile weight', () => {
      const service = seeded();
      const profile = TestBed.inject(UserProfileService);
      profile.update({ weightKg: 74 });

      service.update('old', 80);

      expect(service.entries().map((entry) => entry.kg)).toEqual([74, 80]);
      expect(profile.profile().weightKg).toBe(74);
    });

    it('returns null for an unknown id', () => {
      const service = seeded();

      expect(service.update('missing', 70)).toBeNull();
      expect(service.remove('missing')).toBe(false);
      expect(service.entries()).toHaveLength(2);
    });

    it('removes the latest weigh-in and falls back to the previous one', () => {
      const service = seeded();

      expect(service.remove('new')).toBe(true);

      expect(service.latest()?.id).toBe('old');
      expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(76);
      expect(JSON.parse(storage.getItem(STORAGE_KEY.WEIGHT_LOG) ?? '[]')).toHaveLength(1);
    });

    it('leaves the profile weight as it is when the only weigh-in is removed', () => {
      const service = setup();
      const entry = service.add(72.3);

      service.remove(entry.id);

      expect(service.entries()).toEqual([]);
      expect(service.weighedToday()).toBe(false);
      expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(72.3);
    });
  });

  it('lists the weigh-ins within a range newest first', () => {
    storage.setItem(
      STORAGE_KEY.WEIGHT_LOG,
      JSON.stringify([
        { id: 'b', kg: 75, at: isoDaysAgo(60) },
        { id: 'c', kg: 74, at: isoDaysAgo(2) },
        { id: 'a', kg: 76, at: isoDaysAgo(120) },
      ]),
    );

    const service = setup();

    expect(service.entriesWithin('3m').map((entry) => entry.id)).toEqual(['c', 'b']);
  });

  describe('seriesFor', () => {
    it('is empty without weighings', () => {
      const service = setup();

      expect(service.seriesFor('4u')).toEqual([]);
    });

    it('returns the weighings inside the range, oldest first', () => {
      storage.setItem(
        STORAGE_KEY.WEIGHT_LOG,
        JSON.stringify([
          { id: 'c', kg: 74, at: isoDaysAgo(2) },
          { id: 'b', kg: 75, at: isoDaysAgo(10) },
          { id: 'a', kg: 76, at: isoDaysAgo(40) },
        ]),
      );

      const service = setup();

      expect(service.seriesFor('4u').map((point) => point.kg)).toEqual([75, 74]);
      expect(service.seriesFor('1u').map((point) => point.kg)).toEqual([74]);
      expect(service.seriesFor('3m').map((point) => point.kg)).toEqual([76, 75, 74]);
    });
  });

  it('labels ranges in Danish', () => {
    const service = setup();

    expect(service.rangeLabel('1u')).toBe('Sidste uge');
    expect(service.rangeLabel('4u')).toBe('Sidste 4 uger');
    expect(service.rangeLabel('3m')).toBe('Sidste 3 mdr.');
  });
});
