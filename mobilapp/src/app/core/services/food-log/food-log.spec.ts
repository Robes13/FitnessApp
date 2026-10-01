import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { API_ERROR_MESSAGE_KEY } from '../../constants/api';
import { CursorPage } from '../../models/api';
import { ApiError } from '../../models/api-error';
import { ProductLookupResult, ScannedProduct } from '../../models/barcode';
import { FoodItem } from '../../models/food';
import { FoodDto, FoodLogDto } from '../../models/food-api';
import { testFood, testFoodLog } from '../../testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../testing/test-providers';
import { addDays, startOfDay } from '../../utils/date-format';
import { NOW } from '../../utils/now';
import { ProductLookupService } from '../product-lookup/product-lookup';
import { DuplicateCustomFoodNameError, FOOD_LOG_RETENTION_DAYS, FoodLogService } from './food-log';

const URL = {
  FOODS: '/api/v1/foods',
  FOOD_LOGS: '/api/v1/me/food-logs',
} as const;

const HAVREGRYN = testFood({
  foodId: 12,
  name: 'Havregryn',
  caloriesPer100: 370,
  proteinPer100: 13,
  carbohydratesPer100: 60,
  fatPer100: 7,
});
const SKYR = testFood({ foodId: 11, name: 'Skyr', caloriesPer100: 63, proteinPer100: 11 });

/** Havregryn as the picker hands it over: 60 g of the catalogue food. */
const HAVREGRYN_60_G: FoodItem = {
  id: '12',
  name: 'Havregryn',
  quantity: '60 g',
  kcal: 222,
  protein: 8,
  carbs: 36,
  fat: 4,
};

const JUICE: ScannedProduct = {
  barcode: '5701234567890',
  unit: 'ml',
  item: {
    id: 'off-5701234567890',
    name: 'Appelsinjuice',
    brand: 'Rynkeby',
    quantity: '100 ml',
    kcal: 45,
    protein: 0.7,
    carbs: 10,
    fat: 0,
  },
  servingGrams: null,
};

const CONFLICT = { status: 409, statusText: 'Conflict' } as const;

function page<T>(items: T[], nextCursor: string | null = null): CursorPage<T> {
  return { items, nextCursor, hasMore: nextCursor !== null };
}

/** The API's answer to a `POST me/food-logs` request for `food` (per 100 g). */
function logged(request: TestRequest, foodLogId: number, food: FoodDto): FoodLogDto {
  const body = request.request.body as Pick<
    FoodLogDto,
    'quantity' | 'unit' | 'consumedAt' | 'mealType'
  >;
  const factor = body.quantity / 100;
  return {
    ...body,
    foodLogId,
    foodId: food.foodId,
    foodName: food.name,
    caloriesConsumed: food.caloriesPer100 * factor,
    proteinConsumed: food.proteinPer100 * factor,
    carbohydratesConsumed: food.carbohydratesPer100 * factor,
    fatConsumed: food.fatPer100 * factor,
  };
}

describe('FoodLogService', () => {
  let http: HttpTestingController;
  let lookups: string[];

  function setup(now: () => Date = () => new Date(TEST_NOW)): FoodLogService {
    lookups = [];
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment(),
        { provide: NOW, useValue: now },
        {
          provide: ProductLookupService,
          useValue: {
            lookup: (barcode: string) => {
              lookups.push(barcode);
              return of<ProductLookupResult>({ status: 'found', product: JUICE });
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(FoodLogService);
  }

  /** Loads `foods` and `logs`, one page each. */
  async function load(
    service: FoodLogService,
    foods: FoodDto[] = [],
    logs: FoodLogDto[] = [],
  ): Promise<void> {
    const done = firstValueFrom(service.load());
    http.expectOne(`${URL.FOODS}?limit=100`).flush(page(foods));
    http.expectOne((request) => request.url === URL.FOOD_LOGS).flush(page(logs));
    await done;
  }

  afterEach(() => http.verify());

  it('loads every page of the catalogue and of the last 90 days', async () => {
    const service = setup();
    const today = startOfDay(TEST_NOW);
    const range = `from=${addDays(today, 1 - FOOD_LOG_RETENTION_DAYS).toISOString()}&to=${addDays(today, 1).toISOString()}`;
    const breakfast = testFoodLog(HAVREGRYN_60_G, 'morgen', TEST_NOW, 12);
    const yesterday = testFoodLog(HAVREGRYN_60_G, 'aften', addDays(TEST_NOW, -1), 12);

    const done = firstValueFrom(service.load());
    expect(service.status()).toBe('loading');
    http.expectOne(`${URL.FOODS}?limit=100`).flush(page([HAVREGRYN], 'c1'));
    http.expectOne(`${URL.FOODS}?limit=100&cursor=c1`).flush(page([SKYR]));
    http.expectOne(`${URL.FOOD_LOGS}?${range}&limit=100`).flush(page([breakfast], 'c2'));
    http.expectOne(`${URL.FOOD_LOGS}?${range}&limit=100&cursor=c2`).flush(page([yesterday]));
    await done;

    expect(service.status()).toBe('ready');
    expect(service.foods()).toEqual([HAVREGRYN, SKYR]);
    expect(service.customFoods().map((food) => [food.id, food.quantity, food.kcal])).toEqual([
      ['12', '100 g', 370],
      ['11', '100 g', 63],
    ]);
    expect(service.entries().map((entry) => entry.logId)).toEqual([String(breakfast.foodLogId)]);
    expect(service.byMeal().get('morgen')).toHaveLength(1);
    expect(service.allEntries().map((entry) => entry.meal)).toEqual(['morgen', 'aften']);
    expect(service.dailyTotals(addDays(TEST_NOW, -1), TEST_NOW)).toEqual([
      expect.objectContaining({ entryCount: 1, totals: expect.objectContaining({ kcal: 222 }) }),
      expect.objectContaining({ entryCount: 1, totals: expect.objectContaining({ kcal: 222 }) }),
    ]);
  });

  it('never errors on a failed load – it sets the status to error', async () => {
    const service = setup();

    const done = firstValueFrom(service.load());
    http.expectOne(`${URL.FOODS}?limit=100`).flush(null, { status: 500, statusText: 'Error' });
    http.expectOne((request) => request.url === URL.FOOD_LOGS);

    await expect(done).resolves.toBeUndefined();
    expect(service.status()).toBe('error');
    expect(service.entries()).toEqual([]);
  });

  it('forgets everything on reset', async () => {
    const service = setup();
    await load(service, [HAVREGRYN], [testFoodLog(HAVREGRYN_60_G, 'morgen')]);

    service.reset();

    expect(service.status()).toBe('idle');
    expect(service.foods()).toEqual([]);
    expect(service.entries()).toEqual([]);
  });

  it('logs a catalogue food now with its meal type and puts the answer in state', async () => {
    const service = setup();
    await load(service, [HAVREGRYN]);

    const done = firstValueFrom(service.add(HAVREGRYN_60_G, 'frokost'));
    const request = http.expectOne({ method: 'POST', url: URL.FOOD_LOGS });
    expect(request.request.body).toEqual({
      foodId: 12,
      quantity: 60,
      unit: 'Gram',
      consumedAt: TEST_NOW.toISOString(),
      mealType: 'Lunch',
    });
    request.flush(logged(request, 90, HAVREGRYN));

    await expect(done).resolves.toMatchObject({ logId: '90', meal: 'frokost', kcal: 222 });
    expect(
      service
        .byMeal()
        .get('frokost')
        ?.map((entry) => entry.logId),
    ).toEqual(['90']);
  });

  it('creates a scanned product, then its millilitre serving, then the log', async () => {
    const service = setup();
    await load(service);
    const juice = testFood({
      foodId: 30,
      name: 'Appelsinjuice',
      barcode: JUICE.barcode,
      caloriesPer100: 45,
      proteinPer100: 0.7,
      carbohydratesPer100: 10,
    });

    const done = firstValueFrom(
      service.add(
        { ...JUICE.item, quantity: '250 ml', kcal: 113, protein: 2, carbs: 25 },
        'morgen',
      ),
    );
    const create = http.expectOne({ method: 'POST', url: URL.FOODS });
    expect(create.request.body).toEqual({
      name: 'Appelsinjuice',
      barcode: JUICE.barcode,
      caloriesPer100: 45,
      proteinPer100: 0.7,
      carbohydratesPer100: 10,
      fatPer100: 0,
    });
    create.flush(juice);
    const serving = http.expectOne({ method: 'PUT', url: `${URL.FOODS}/30/servings/Milliliter` });
    expect(serving.request.body).toEqual({ gramsPerUnit: 1 });
    serving.flush({ foodServingId: 4, unit: 'Milliliter', gramsPerUnit: 1 });
    const log = http.expectOne({ method: 'POST', url: URL.FOOD_LOGS });
    expect(log.request.body).toMatchObject({ foodId: 30, quantity: 250, unit: 'Milliliter' });
    log.flush(logged(log, 91, juice));

    await expect(done).resolves.toMatchObject({ quantity: '250 ml', kcal: 113 });
    expect(lookups).toEqual([JUICE.barcode]);
    expect(service.foods()[0]?.servings).toEqual([
      { foodServingId: 4, unit: 'Milliliter', gramsPerUnit: 1 },
    ]);
  });

  it('reuses the catalogue food with the scanned barcode', async () => {
    const service = setup();
    const juice = testFood({
      foodId: 30,
      name: 'Appelsinjuice',
      barcode: JUICE.barcode,
      servings: [{ foodServingId: 4, unit: 'Milliliter', gramsPerUnit: 1 }],
    });
    await load(service, [juice]);

    await expect(
      firstValueFrom(service.ensureFood({ ...JUICE.item, quantity: '250 ml' })),
    ).resolves.toBe(juice);
    expect(lookups).toEqual([]);
  });

  it('retries a taken product name once with the brand', async () => {
    const service = setup();
    await load(service);

    const done = firstValueFrom(service.ensureFood({ ...JUICE.item, quantity: '100 g' }));
    http.expectOne({ method: 'POST', url: URL.FOODS }).flush({ status: 409 }, CONFLICT);
    const retry = http.expectOne({ method: 'POST', url: URL.FOODS });
    expect(retry.request.body).toMatchObject({ name: 'Appelsinjuice (Rynkeby)' });
    retry.flush(testFood({ foodId: 31, name: 'Appelsinjuice (Rynkeby)' }));

    await expect(done).resolves.toMatchObject({ foodId: 31 });
  });

  it('creates an unsaved custom food per portion with its synthetic piece serving', async () => {
    const service = setup();
    await load(service);
    const pancake: FoodItem = {
      id: 'food-local',
      name: ' Proteinpandekage ',
      quantity: '2 stk',
      kcal: 310,
      protein: 24,
      carbs: 30,
      fat: 9,
      isCustom: true,
    };

    const done = firstValueFrom(service.add(pancake, 'snack'));
    const create = http.expectOne({ method: 'POST', url: URL.FOODS });
    expect(create.request.body).toEqual({
      name: 'Proteinpandekage',
      caloriesPer100: 155,
      proteinPer100: 12,
      carbohydratesPer100: 15,
      fatPer100: 4.5,
    });
    const food = testFood({ foodId: 40, name: 'Proteinpandekage', caloriesPer100: 155 });
    create.flush(food);
    http
      .expectOne({ method: 'PUT', url: `${URL.FOODS}/40/servings/Piece` })
      .flush({ foodServingId: 5, unit: 'Piece', gramsPerUnit: 100 });
    const log = http.expectOne({ method: 'POST', url: URL.FOOD_LOGS });
    expect(log.request.body).toMatchObject({ foodId: 40, quantity: 2, unit: 'Piece' });
    log.flush({ ...logged(log, 92, food), caloriesConsumed: 310 });

    await expect(done).resolves.toMatchObject({ quantity: '2 stk', kcal: 310, meal: 'snack' });
    expect(service.customFoods()[0]).toMatchObject({ id: '40', quantity: '1 stk', kcal: 155 });
  });

  it('saves the barcode the scanner did not find with the new food (3.1-6a)', async () => {
    const service = setup();
    await load(service);
    const input = {
      name: 'Ukendt bar',
      quantity: '40 g',
      kcal: 180,
      protein: 8,
      carbs: 20,
      fat: 6,
      barcode: '5799999999991',
    };

    const saved = firstValueFrom(service.addCustomFood(input));
    const create = http.expectOne({ method: 'POST', url: URL.FOODS });
    expect(create.request.body).toMatchObject({ name: 'Ukendt bar', barcode: '5799999999991' });
    create.flush(testFood({ foodId: 51, name: 'Ukendt bar', barcode: '5799999999991' }));
    await saved;

    expect(service.foods()[0]?.barcode).toBe('5799999999991');
  });

  it('heals a catalogue food that lacks the serving of the logged unit', async () => {
    const service = setup();
    await load(service, [testFood({ foodId: 41, name: 'Proteinbar', caloriesPer100: 200 })]);

    const done = firstValueFrom(
      service.ensureFood({ ...HAVREGRYN_60_G, id: '41', quantity: '1 portion' }),
    );
    const serving = http.expectOne({ method: 'PUT', url: `${URL.FOODS}/41/servings/Serving` });
    expect(serving.request.body).toEqual({ gramsPerUnit: 100 });
    serving.flush({ foodServingId: 6, unit: 'Serving', gramsPerUnit: 100 });

    await expect(done).resolves.toMatchObject({ foodId: 41, servings: [{ unit: 'Serving' }] });
  });

  it('reuses a catalogue food with the same name instead of creating it twice', async () => {
    const service = setup();
    await load(service, [HAVREGRYN]);

    await expect(
      firstValueFrom(
        service.ensureFood({ ...HAVREGRYN_60_G, id: 'food-local', name: ' havregryn' }),
      ),
    ).resolves.toBe(HAVREGRYN);
  });

  it('saves a custom food and errors with DuplicateCustomFoodNameError on 409', async () => {
    const service = setup();
    await load(service);
    const input = { name: 'Egen bar', quantity: '50 g', kcal: 200, protein: 10, carbs: 20, fat: 8 };

    const saved = firstValueFrom(service.addCustomFood(input));
    const create = http.expectOne({ method: 'POST', url: URL.FOODS });
    expect(create.request.body).toEqual({
      name: 'Egen bar',
      caloriesPer100: 400,
      proteinPer100: 20,
      carbohydratesPer100: 40,
      fatPer100: 16,
    });
    create.flush(testFood({ foodId: 50, name: 'Egen bar', caloriesPer100: 400 }));
    await expect(saved).resolves.toMatchObject({ id: '50', quantity: '100 g', kcal: 400 });
    expect(service.hasCustomFoodNamed(' EGEN bar')).toBe(true);

    // A name taken in the API (e.g. on another device) but not in this catalogue.
    const duplicate = firstValueFrom(service.addCustomFood({ ...input, name: 'Anden bar' }));
    http.expectOne({ method: 'POST', url: URL.FOODS }).flush({ status: 409 }, CONFLICT);
    await expect(duplicate).rejects.toBeInstanceOf(DuplicateCustomFoodNameError);
    expect(service.foods()).toHaveLength(1);
  });

  it('heals a custom food whose serving failed on the next save instead of creating it twice', async () => {
    const service = setup();
    await load(service);
    const input = { name: 'Kiks', quantity: '1 stk', kcal: 80, protein: 1, carbs: 10, fat: 4 };
    const kiks = testFood({ foodId: 51, name: 'Kiks', caloriesPer100: 80 });

    const first = firstValueFrom(service.addCustomFood(input));
    http.expectOne({ method: 'POST', url: URL.FOODS }).flush(kiks);
    http
      .expectOne({ method: 'PUT', url: `${URL.FOODS}/51/servings/Piece` })
      .flush(null, { status: 500, statusText: 'Error' });
    await expect(first).rejects.toMatchObject({ messageKey: expect.any(String) });
    expect(service.customFoods()[0]).toMatchObject({ id: '51', quantity: '100 g' });

    const second = firstValueFrom(service.addCustomFood(input));
    http
      .expectOne({ method: 'PUT', url: `${URL.FOODS}/51/servings/Piece` })
      .flush({ foodServingId: 7, unit: 'Piece', gramsPerUnit: 100 });

    await expect(second).resolves.toMatchObject({ id: '51', quantity: '1 stk', kcal: 80 });
    expect(service.foods()).toHaveLength(1);
  });

  it('changes only the amount of a log and puts the recalculated row in state', async () => {
    const service = setup();
    const row = testFoodLog(HAVREGRYN_60_G, 'morgen', TEST_NOW, 12);
    await load(service, [HAVREGRYN], [row]);

    const done = firstValueFrom(service.update(String(row.foodLogId), { quantity: '120 g' }));
    const patch = http.expectOne({ method: 'PATCH', url: `${URL.FOOD_LOGS}/${row.foodLogId}` });
    expect(patch.request.body).toEqual({ quantity: 120, unit: 'Gram' });
    patch.flush({ ...row, quantity: 120, caloriesConsumed: 444 });
    await done;

    expect(service.entries()).toEqual([
      expect.objectContaining({ quantity: '120 g', kcal: 444, meal: 'morgen' }),
    ]);
  });

  it('removes a log once the API has deleted it', async () => {
    const service = setup();
    const row = testFoodLog(HAVREGRYN_60_G, 'morgen');
    await load(service, [HAVREGRYN], [row]);

    const done = firstValueFrom(service.remove(String(row.foodLogId)), { defaultValue: null });
    expect(service.entries()).toHaveLength(1);
    http
      .expectOne({ method: 'DELETE', url: `${URL.FOOD_LOGS}/${row.foodLogId}` })
      .flush(null, { status: 204, statusText: 'No Content' });
    await done;

    expect(service.entries()).toEqual([]);
  });

  it('drops a log that is already gone and says so', async () => {
    const service = setup();
    const row = testFoodLog(HAVREGRYN_60_G, 'morgen');
    await load(service, [HAVREGRYN], [row]);

    const done = firstValueFrom(service.remove(String(row.foodLogId)));
    http
      .expectOne({ method: 'DELETE', url: `${URL.FOOD_LOGS}/${row.foodLogId}` })
      .flush(null, { status: 404, statusText: 'Not Found' });

    const notFound: ApiError = { messageKey: 'food.page.notFound', status: 404 };
    await expect(done).rejects.toEqual(notFound);
    expect(service.entries()).toEqual([]);
  });

  it('leaves the state unchanged when a mutation fails', async () => {
    const service = setup();
    const row = testFoodLog(HAVREGRYN_60_G, 'morgen');
    await load(service, [HAVREGRYN], [row]);

    const add = firstValueFrom(service.add(HAVREGRYN_60_G, 'aften'));
    http
      .expectOne({ method: 'POST', url: URL.FOOD_LOGS })
      .flush(null, { status: 500, statusText: 'Error' });
    await expect(add).rejects.toMatchObject({ messageKey: API_ERROR_MESSAGE_KEY.SERVER });

    const remove = firstValueFrom(service.remove(String(row.foodLogId)));
    http
      .expectOne({ method: 'DELETE', url: `${URL.FOOD_LOGS}/${row.foodLogId}` })
      .error(new ProgressEvent('error'));
    await expect(remove).rejects.toMatchObject({ messageKey: API_ERROR_MESSAGE_KEY.NETWORK });

    expect(service.entries().map((entry) => entry.logId)).toEqual([String(row.foodLogId)]);
  });

  it('starts a new day at midnight but keeps yesterday readable', () => {
    vi.useFakeTimers();
    try {
      let now = new Date(TEST_NOW);
      const service = setup(() => new Date(now));
      service.addLogs([testFoodLog(HAVREGRYN_60_G, 'snack')]);

      const midnight = new Date(2026, 8, 22);
      now = midnight;
      vi.advanceTimersByTime(midnight.getTime() - TEST_NOW.getTime());
      service.addLogs([testFoodLog(HAVREGRYN_60_G, 'morgen', new Date(2026, 8, 22, 7))]);

      expect(service.today()).toBe('2026-09-22');
      expect(service.entries().map((entry) => entry.meal)).toEqual(['morgen']);
      expect(service.entriesFor(TEST_NOW).map((entry) => entry.meal)).toEqual(['snack']);
    } finally {
      vi.useRealTimers();
    }
  });
});
