import { NOW } from '../../utils/now';
import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../../constants/storage-key';
import { FoodItem, LoggedFood } from '../../models/food';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { TEST_NOW, provideCoreTestEnvironment } from '../../testing/test-providers';
import { DuplicateCustomFoodNameError, FOOD_LOG_RETENTION_DAYS, FoodLogService } from './food-log';
import { addDays, toIsoDate } from '../../utils/date-format';

const HAVREGRYN: FoodItem = {
  id: 'food-havregryn',
  name: 'Havregryn',
  quantity: '60 g',
  kcal: 222,
  protein: 8,
  carbs: 38,
  fat: 4,
};

describe('FoodLogService', () => {
  let storage: FakeStorage;

  function setup(): FoodLogService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    return TestBed.inject(FoodLogService);
  }

  function storedDays(): Record<string, readonly LoggedFood[]> {
    const raw = storage.getItem(STORAGE_KEY.FOOD_LOG) ?? '{"days":{}}';
    return (JSON.parse(raw) as { days: Record<string, readonly LoggedFood[]> }).days;
  }

  function storedEntries(date = '2026-09-21'): readonly LoggedFood[] {
    return storedDays()[date] ?? [];
  }

  function logged(logId: string, food: FoodItem = HAVREGRYN): LoggedFood {
    return { ...food, logId, meal: 'snack', loggedAt: TEST_NOW.toISOString() };
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('starts a new day after midnight but keeps yesterday readable', () => {
    let now = new Date(TEST_NOW);
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment({ storage }),
        { provide: NOW, useValue: () => new Date(now) },
      ],
    });
    const service = TestBed.inject(FoodLogService);
    const old = service.add(HAVREGRYN, 'snack');
    now = new Date(2026, 8, 22, 1);
    service.update(old.logId, { kcal: 999 });
    expect(service.entries()).toEqual([]);
    service.add(HAVREGRYN, 'morgen');
    expect(service.totals().kcal).toBe(222);
    // The stale update after midnight didn't touch yesterday's entry.
    expect(storedEntries('2026-09-21')[0]?.kcal).toBe(222);
    expect(storedEntries('2026-09-22')).toHaveLength(1);
    expect(service.entriesFor(new Date(2026, 8, 21))).toHaveLength(1);
    expect(service.allEntries()).toHaveLength(2);
  });

  it('clears the visible log at midnight without user input', () => {
    vi.useFakeTimers();
    try {
      const now = new Date(2026, 8, 21, 23, 59, 59);
      TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage, now }) });
      const service = TestBed.inject(FoodLogService);
      service.add(HAVREGRYN, 'snack');
      expect(service.today()).toBe('2026-09-21');
      now.setDate(22);
      now.setHours(0, 0, 0, 0);
      vi.advanceTimersByTime(1000);
      expect(service.today()).toBe('2026-09-22');
      expect(service.entries()).toEqual([]);
      expect(service.totals().kcal).toBe(0);
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  it('starts empty on first run and writes nothing', () => {
    const service = setup();

    expect(service.entries()).toEqual([]);
    expect(service.totals()).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(storage.getItem(STORAGE_KEY.FOOD_LOG)).toBeNull();
  });

  it('migrates the old single-day format', () => {
    storage.setItem(
      STORAGE_KEY.FOOD_LOG,
      JSON.stringify({
        date: '2026-09-21',
        entries: [
          { ...HAVREGRYN, logId: 'log-1', meal: 'snack', loggedAt: TEST_NOW.toISOString() },
        ],
      }),
    );

    const service = setup();

    expect(service.entries()).toHaveLength(1);
    expect(service.entries()[0]?.name).toBe('Havregryn');
  });

  it('starts a new day empty and keeps the previous day as history', () => {
    storage.setItem(
      STORAGE_KEY.FOOD_LOG,
      JSON.stringify({
        date: '2026-09-20',
        entries: [
          { ...HAVREGRYN, logId: 'log-1', meal: 'snack', loggedAt: TEST_NOW.toISOString() },
        ],
      }),
    );

    const service = setup();

    expect(service.entries()).toEqual([]);
    expect(service.totals().kcal).toBe(0);
    expect(service.totalsFor(new Date(2026, 8, 20)).kcal).toBe(222);
  });

  it('restores the multi-day format and prunes days outside the retention window', () => {
    const oldest = toIsoDate(addDays(TEST_NOW, 1 - FOOD_LOG_RETENTION_DAYS));
    const tooOld = toIsoDate(addDays(TEST_NOW, -FOOD_LOG_RETENTION_DAYS));
    storage.setItem(
      STORAGE_KEY.FOOD_LOG,
      JSON.stringify({
        days: { [tooOld]: [logged('log-old')], [oldest]: [logged('log-kept')] },
      }),
    );

    const service = setup();

    expect(service.allEntries().map((entry) => entry.logId)).toEqual(['log-kept']);
    expect(Object.keys(storedDays())).toEqual([oldest]);
  });

  it('drops malformed days from storage instead of crashing', () => {
    storage.setItem(
      STORAGE_KEY.FOOD_LOG,
      JSON.stringify({
        days: { '2026-09-19': 'broken', '2026-09-20': null, '2026-09-21': [logged('log-ok')] },
      }),
    );

    const service = setup();

    expect(service.entries().map((entry) => entry.logId)).toEqual(['log-ok']);
    expect(service.allEntries().map((entry) => entry.logId)).toEqual(['log-ok']);
    expect(service.entriesFor(new Date(2026, 8, 19))).toEqual([]);
  });

  it('sums a daily series over a date range, including days without a log', () => {
    storage.setItem(
      STORAGE_KEY.FOOD_LOG,
      JSON.stringify({
        days: {
          '2026-09-19': [logged('log-1'), logged('log-2')],
          '2026-09-21': [logged('log-3')],
        },
      }),
    );

    const service = setup();
    const series = service.dailyTotals(new Date(2026, 8, 19), new Date(2026, 8, 21, 23));

    expect(series.map((day) => day.date)).toEqual(['2026-09-19', '2026-09-20', '2026-09-21']);
    expect(series.map((day) => day.entryCount)).toEqual([2, 0, 1]);
    expect(series[0]?.totals).toEqual({ kcal: 444, protein: 16, carbs: 76, fat: 8 });
    expect(series[1]?.totals.kcal).toBe(0);
    expect(service.allEntries().map((entry) => entry.logId)).toEqual(['log-3', 'log-1', 'log-2']);
  });

  it('adds an entry with log id, meal and timestamp', () => {
    const service = setup();

    const entry = service.add(HAVREGRYN, 'snack');

    expect(entry.logId).toMatch(/^log-/);
    expect(entry.meal).toBe('snack');
    expect(entry.loggedAt).toBe(TEST_NOW.toISOString());
    expect(service.entries()).toHaveLength(1);
    expect(service.totals().kcal).toBe(222);
    expect(storedEntries()).toHaveLength(1);
  });

  it('groups entries by meal with an entry for every meal', () => {
    const service = setup();
    service.add(HAVREGRYN, 'snack');

    const byMeal = service.byMeal();

    expect([...byMeal.keys()]).toEqual(['morgen', 'frokost', 'aften', 'snack']);
    expect(byMeal.get('morgen')).toEqual([]);
    expect(byMeal.get('aften')).toEqual([]);
    expect(byMeal.get('snack')?.[0]?.name).toBe('Havregryn');
  });

  it('updates and removes entries by log id', () => {
    const service = setup();
    const entry = service.add(HAVREGRYN, 'snack');

    service.update(entry.logId, { quantity: '120 g', kcal: 444, meal: 'aften' });
    const updated = service.entries().find((candidate) => candidate.logId === entry.logId);
    expect(updated).toMatchObject({ quantity: '120 g', kcal: 444, meal: 'aften' });

    service.remove(entry.logId);
    expect(service.entries().some((candidate) => candidate.logId === entry.logId)).toBe(false);
    expect(storedEntries()).toHaveLength(0);
  });

  it('adds custom foods first, flagged as custom, and persists them separately', () => {
    const service = setup();

    const first = service.addCustomFood({
      name: 'Egen bar',
      quantity: '1 stk',
      kcal: 150,
      protein: 12,
      carbs: 10,
      fat: 5,
    });
    const second = service.addCustomFood({
      name: 'Anden vare',
      quantity: '100 g',
      kcal: 90,
      protein: 2,
      carbs: 10,
      fat: 1,
    });

    expect(first.isCustom).toBe(true);
    expect(first.id).toMatch(/^food-/);
    expect(service.customFoods().map((food) => food.id)).toEqual([second.id, first.id]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.CUSTOM_FOODS) ?? '[]')).toHaveLength(2);
  });

  it('restores custom foods', () => {
    storage.setItem(STORAGE_KEY.CUSTOM_FOODS, JSON.stringify([{ ...HAVREGRYN, isCustom: true }]));

    const service = setup();

    expect(service.customFoods()).toHaveLength(1);
  });

  it('updates a custom food and leaves logged entries untouched', () => {
    const service = setup();
    const food = service.addCustomFood({
      name: 'Egen bar',
      quantity: '1 stk',
      kcal: 150,
      protein: 12,
      carbs: 10,
      fat: 5,
    });
    service.add(food, 'snack');

    const updated = service.updateCustomFood(food.id, {
      name: 'Egen bar',
      quantity: '1 stk',
      kcal: 180,
      protein: 15,
      carbs: 12,
      fat: 6,
    });

    expect(updated).toMatchObject({ id: food.id, kcal: 180, isCustom: true });
    expect(service.customFoods()).toHaveLength(1);
    expect(service.customFoods()[0]?.kcal).toBe(180);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.CUSTOM_FOODS) ?? '[]')[0].kcal).toBe(180);
    expect(service.entries()[0]?.kcal).toBe(150);
    expect(service.updateCustomFood('food-missing', food)).toBeNull();
  });

  it('finds custom foods by trimmed, case-insensitive name', () => {
    const service = setup();
    const food = service.addCustomFood({
      name: 'Egen Bar',
      quantity: '1 stk',
      kcal: 150,
      protein: 12,
      carbs: 10,
      fat: 5,
    });

    expect(service.hasCustomFoodNamed('  egen bar ')).toBe(true);
    expect(service.hasCustomFoodNamed('Anden bar')).toBe(false);
    expect(service.hasCustomFoodNamed('egen bar', food.id)).toBe(false);
  });

  it('keeps a caller-decided id for a new custom food', () => {
    const service = setup();

    const food = service.addCustomFood(
      { name: 'Egen bar', quantity: '1 stk', kcal: 150, protein: 12, carbs: 10, fat: 5 },
      'food-picked',
    );

    expect(food.id).toBe('food-picked');
    expect(service.customFoods()[0]?.id).toBe('food-picked');
  });

  it('rejects a duplicate custom food name on add and update', () => {
    const service = setup();
    const input = { quantity: '1 stk', kcal: 150, protein: 12, carbs: 10, fat: 5 };
    service.addCustomFood({ ...input, name: 'Egen Bar' });
    const other = service.addCustomFood({ ...input, name: 'Anden bar' });

    expect(() => service.addCustomFood({ ...input, name: ' egen bar ' })).toThrow(
      DuplicateCustomFoodNameError,
    );
    expect(() => service.updateCustomFood(other.id, { ...input, name: 'EGEN BAR' })).toThrow(
      DuplicateCustomFoodNameError,
    );
    expect(
      service.updateCustomFood(other.id, { ...input, name: 'Anden bar', kcal: 99 })?.kcal,
    ).toBe(99);
    expect(service.customFoods()).toHaveLength(2);
  });
});
