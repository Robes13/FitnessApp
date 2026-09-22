import { TestBed } from '@angular/core/testing';
import { FOOD_DATABASE } from '../constants/demo-data';
import { STORAGE_KEY } from '../constants/storage-key';
import { FoodItem, LoggedFood } from '../models/food';
import { FakeStorage, createFakeStorage } from '../testing/fake-document';
import { TEST_NOW, provideCoreTestEnvironment } from '../testing/test-providers';
import { FoodLogService } from './food-log';

const HAVREGRYN = FOOD_DATABASE[0] as FoodItem;

describe('FoodLogService', () => {
  let storage: FakeStorage;

  function setup(): FoodLogService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    return TestBed.inject(FoodLogService);
  }

  function storedEntries(): readonly LoggedFood[] {
    const raw = storage.getItem(STORAGE_KEY.FOOD_LOG) ?? '{}';
    return (JSON.parse(raw) as { entries: readonly LoggedFood[] }).entries;
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('seeds the two demo foods on first run and persists them for today', () => {
    const service = setup();

    expect(service.entries().map((entry) => entry.name)).toEqual([
      'Skyr-bowl med bær',
      'Kyllingesalat',
    ]);
    expect(service.totals()).toEqual({ kcal: 830, protein: 73, carbs: 56, fat: 31 });
    expect(JSON.parse(storage.getItem(STORAGE_KEY.FOOD_LOG) ?? '')).toMatchObject({
      date: '2026-09-21',
    });
    expect(storedEntries()).toHaveLength(2);
  });

  it('restores a stored log from the same day', () => {
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

  it('starts a new day empty instead of reseeding', () => {
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
  });

  it('adds an entry with log id, meal and timestamp', () => {
    const service = setup();

    const entry = service.add(HAVREGRYN, 'snack');

    expect(entry.logId).toMatch(/^log-/);
    expect(entry.meal).toBe('snack');
    expect(entry.loggedAt).toBe(TEST_NOW.toISOString());
    expect(service.entries()).toHaveLength(3);
    expect(service.totals().kcal).toBe(830 + 222);
    expect(storedEntries()).toHaveLength(3);
  });

  it('groups entries by meal with an entry for every meal', () => {
    const service = setup();
    service.add(HAVREGRYN, 'snack');

    const byMeal = service.byMeal();

    expect([...byMeal.keys()]).toEqual(['morgen', 'frokost', 'aften', 'snack']);
    expect(byMeal.get('morgen')?.map((entry) => entry.name)).toEqual(['Skyr-bowl med bær']);
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
    expect(storedEntries()).toHaveLength(2);
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
});
