import { TestBed } from '@angular/core/testing';
import { DEMO_PROFILE_DEFAULTS } from '../constants/demo-data';
import { STORAGE_KEY } from '../constants/storage-key';
import { WeighEntry } from '../models/weight';
import { FakeStorage, createFakeStorage } from '../testing/fake-document';
import { TEST_NOW, provideCoreTestEnvironment } from '../testing/test-providers';
import { UserProfileService } from './user-profile';
import { WeightLogService } from './weight-log';

const MS_PER_DAY = 86_400_000;

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

  it('seeds three demo entries newest first on first run', () => {
    const service = setup();

    expect(service.entries().map(daysAgo)).toEqual([3, 7, 14]);
    expect(service.entries().map((entry) => entry.kg)).toEqual([75, 75.6, 76.1]);
    expect(service.latest()?.kg).toBe(75);
    expect(service.weighedToday()).toBe(false);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.WEIGHT_LOG) ?? '[]')).toHaveLength(3);
  });

  it('seeds lighter history when the goal is to gain', () => {
    storage.setItem(
      STORAGE_KEY.PROFILE,
      JSON.stringify({ ...DEMO_PROFILE_DEFAULTS, weightKg: 60, goal: 'tage' }),
    );

    const service = setup();

    expect(service.entries().map((entry) => entry.kg)).toEqual([60, 59.6, 59.1]);
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
    expect(JSON.parse(storage.getItem(STORAGE_KEY.WEIGHT_LOG) ?? '[]')).toHaveLength(4);
  });

  it('keeps entries ordered when adding a back-dated weighing', () => {
    const service = setup();

    service.add(77, new Date(2026, 8, 1));

    expect(service.entries().map(daysAgo)).toEqual([3, 7, 14, 20]);
  });

  describe('seriesFor', () => {
    it('returns 12 chronological points ending now', () => {
      const service = setup();

      const series = service.seriesFor('4u', 'tabe', 75);

      expect(series).toHaveLength(12);
      expect(series.at(-1)?.at).toBe(TEST_NOW.toISOString());
      expect(new Date(series[0]?.at ?? '').getTime()).toBe(TEST_NOW.getTime() - 28 * MS_PER_DAY);
      const times = series.map((point) => new Date(point.at).getTime());
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    });

    it('drifts down towards the current weight when losing, scaled by the range', () => {
      const service = setup();

      expect(service.seriesFor('4u', 'tabe', 75)[0]?.kg).toBeCloseTo(77.6);
      expect(service.seriesFor('1u', 'tabe', 75)[0]?.kg).toBeCloseTo(75.65);
      expect(service.seriesFor('3m', 'tabe', 75)[0]?.kg).toBeCloseTo(75 + 2.6 * (90 / 28));
    });

    it('drifts up when gaining and stays flat when maintaining', () => {
      const service = setup();

      expect(service.seriesFor('4u', 'tage', 75)[0]?.kg).toBeCloseTo(72.6);
      expect(service.seriesFor('4u', 'hold', 75)[0]?.kg).toBeCloseTo(75);
    });

    it('ends on the current weight plus the design wobble', () => {
      const service = setup();

      const last = service.seriesFor('4u', 'hold', 75).at(-1);

      expect(last?.kg).toBeCloseTo(75 + Math.sin(11 * 1.7) * 0.35);
    });

    it('treats a missing goal like losing', () => {
      const service = setup();

      expect(service.seriesFor('4u', null, 75)).toEqual(service.seriesFor('4u', 'tabe', 75));
    });
  });

  it('labels ranges in Danish', () => {
    const service = setup();

    expect(service.rangeLabel('1u')).toBe('Sidste uge');
    expect(service.rangeLabel('4u')).toBe('Sidste 4 uger');
    expect(service.rangeLabel('3m')).toBe('Sidste 3 mdr.');
  });
});
