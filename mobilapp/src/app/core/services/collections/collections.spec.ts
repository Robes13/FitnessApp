import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CollectionItem, FoodItem } from '../../models/food';
import { MealCollectionDto } from '../../models/food-api';
import {
  TEST_FOOD,
  flushTestCollections,
  flushTestFoodLog,
  testCollection,
  testFood,
  testFoodLog,
} from '../../testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../testing/test-providers';
import { FoodLogService } from '../food-log/food-log';
import { CollectionsService } from './collections';

const URL = {
  COLLECTIONS: '/api/v1/me/meal-collections',
  collection: (id: number) => `/api/v1/me/meal-collections/${id}`,
} as const;

const HAVREGRYN = testFood({
  foodId: 12,
  name: 'Havregryn',
  caloriesPer100: 370,
  proteinPer100: 13,
  carbohydratesPer100: 60,
  fatPer100: 7,
});
/** A food the app created per piece: `…Per100` is per piece, the serving is 100 g. */
const BAR = testFood({
  foodId: 13,
  name: 'Proteinbar',
  caloriesPer100: 210,
  proteinPer100: 20,
  servings: [{ foodServingId: 1, unit: 'Piece', gramsPerUnit: 100 }],
});
const SKYR = testFood({ foodId: 11, name: 'Skyr', caloriesPer100: 63, proteinPer100: 11 });

const MORGEN: MealCollectionDto = testCollection(5, 'Morgen', [
  { foodId: 12, foodName: 'Havregryn', quantity: 60, unit: 'Gram' },
  { foodId: 13, foodName: 'Proteinbar', quantity: 2, unit: 'Piece' },
]);

describe('CollectionsService', () => {
  let service: CollectionsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    service = TestBed.inject(CollectionsService);
    http = TestBed.inject(HttpTestingController);
    flushTestFoodLog([HAVREGRYN, BAR, SKYR]);
  });

  afterEach(() => http.verify());

  /** Answers the one open request, which must be `method url`, and returns what was sent. */
  function answer(method: string, url: string, body: object | null = null): unknown {
    // Nothing else may be open – the steps run one after the other.
    expect(http.match((request) => request.method !== method || request.url !== url)).toEqual([]);
    const request = http.expectOne({ method, url });
    request.flush(body);
    return request.request.body;
  }

  it('maps the API collections and scales each item from its food', () => {
    expect(service.status()).toBe('idle');

    flushTestCollections([MORGEN]);

    expect(service.status()).toBe('ready');
    expect(service.collections()).toEqual([
      {
        id: '5',
        name: 'Morgen',
        items: [
          {
            id: '12',
            mealItemId: 1,
            name: 'Havregryn',
            quantity: '60 g',
            kcal: 222,
            protein: 8,
            carbs: 36,
            fat: 4,
          },
          {
            id: '13',
            mealItemId: 2,
            name: 'Proteinbar',
            quantity: '2 stk',
            kcal: 420,
            protein: 40,
            carbs: 0,
            fat: 0,
          },
        ],
      },
    ]);
    const [collection] = service.collections();
    expect(collection && service.collectionTotals(collection)).toEqual({
      kcal: 642,
      protein: 48,
      carbs: 36,
      fat: 4,
      count: 2,
    });
  });

  it('shows an item whose food is not in the catalogue with 0 until it is', () => {
    flushTestCollections([
      testCollection(6, 'Ukendt', [{ foodId: 99, foodName: 'Ny', quantity: 100, unit: 'Gram' }]),
    ]);

    expect(service.collectionById('6')?.items[0]).toMatchObject({ name: 'Ny', kcal: 0 });
  });

  it('follows every page', async () => {
    const done = firstValueFrom(service.load());
    http
      .expectOne(`${URL.COLLECTIONS}?limit=100`)
      .flush({ items: [MORGEN], nextCursor: 'c1', hasMore: true });
    http
      .expectOne(`${URL.COLLECTIONS}?limit=100&cursor=c1`)
      .flush({ items: [testCollection(4, 'Ældre', [])], nextCursor: null, hasMore: false });
    await done;

    expect(service.collections().map((collection) => collection.id)).toEqual(['5', '4']);
  });

  it('sets status error when the load fails, without erroring', async () => {
    const done = firstValueFrom(service.load());
    http
      .expectOne(`${URL.COLLECTIONS}?limit=100`)
      .flush(null, { status: 503, statusText: 'Unavailable' });
    await done;

    expect(service.status()).toBe('error');
    expect(service.collections()).toEqual([]);
  });

  it('forgets the collections on reset', () => {
    flushTestCollections([MORGEN]);

    service.reset();

    expect(service.status()).toBe('idle');
    expect(service.collections()).toEqual([]);
  });

  it('checks names trimmed and case-insensitively, except the collection being edited', () => {
    flushTestCollections([MORGEN]);

    expect(service.isNameTaken('  MORGEN ')).toBe(true);
    expect(service.isNameTaken('morgen', '5')).toBe(false);
    expect(service.isNameTaken('Morgen 2')).toBe(false);
  });

  it('creates the foods first, then the collection with their ids', async () => {
    const custom: FoodItem = {
      id: 'food-new',
      name: 'Egen bar',
      quantity: '2 stk',
      kcal: 300,
      protein: 20,
      carbs: 30,
      fat: 10,
    };
    const oats: FoodItem = { ...TEST_FOOD, id: '12', name: 'Havregryn', quantity: '60 g' };
    const done = firstValueFrom(service.create({ name: ' Morgen ', items: [oats, custom] }));

    expect(answer('POST', '/api/v1/foods', testFood({ foodId: 20, name: 'Egen bar' }))).toEqual({
      name: 'Egen bar',
      caloriesPer100: 150,
      proteinPer100: 10,
      carbohydratesPer100: 15,
      fatPer100: 5,
    });
    answer('PUT', '/api/v1/foods/20/servings/Piece', {
      foodServingId: 2,
      unit: 'Piece',
      gramsPerUnit: 100,
    });
    const created = testCollection(7, 'Morgen', [
      { foodId: 12, foodName: 'Havregryn', quantity: 60, unit: 'Gram' },
      { foodId: 20, foodName: 'Egen bar', quantity: 2, unit: 'Piece' },
    ]);
    expect(answer('POST', URL.COLLECTIONS, created)).toEqual({
      name: 'Morgen',
      items: [
        { foodId: 12, quantity: 60, unit: 'Gram' },
        { foodId: 20, quantity: 2, unit: 'Piece' },
      ],
    });
    await done;

    expect(service.collectionById('7')?.items.map((item) => item.mealItemId)).toEqual([1, 2]);
  });

  it('names what failed when the API rejects the new collection', async () => {
    const oats: FoodItem = { ...TEST_FOOD, id: '12', name: 'Havregryn', quantity: '60 g' };
    const done = firstValueFrom(service.create({ name: 'Morgen', items: [oats] }));
    http.expectOne(URL.COLLECTIONS).flush(null, { status: 400, statusText: 'Bad Request' });

    await expect(done).rejects.toEqual({ messageKey: 'collections.saveError', status: 400 });
    expect(service.collections()).toEqual([]);
  });

  describe('update', () => {
    beforeEach(() => flushTestCollections([MORGEN]));

    /** The draft: item 1 kept, item 2 dropped and 150 g Skyr added. */
    function draft(): readonly CollectionItem[] {
      const oats = service.collectionById('5')?.items[0];
      const skyr: FoodItem = { ...TEST_FOOD, id: '11', name: 'Skyr', quantity: '150 g' };
      return oats ? [oats, skyr] : [skyr];
    }

    it('saves the diff in order: PATCH → POST → DELETE → GET', async () => {
      const done = firstValueFrom(service.update('5', { name: 'Morgenmad ', items: draft() }));

      expect(answer('PATCH', URL.collection(5), { ...MORGEN, name: 'Morgenmad' })).toEqual({
        name: 'Morgenmad',
      });
      expect(answer('POST', `${URL.collection(5)}/items`, {})).toEqual({
        foodId: 11,
        quantity: 150,
        unit: 'Gram',
      });
      answer('DELETE', `${URL.collection(5)}/items/2`);
      const saved = testCollection(5, 'Morgenmad', [
        { foodId: 12, foodName: 'Havregryn', quantity: 60, unit: 'Gram' },
        { mealItemId: 3, foodId: 11, foodName: 'Skyr', quantity: 150, unit: 'Gram' },
      ]);
      answer('GET', URL.collection(5), saved);
      await done;

      expect(service.collectionById('5')).toMatchObject({
        name: 'Morgenmad',
        items: [{ name: 'Havregryn' }, { name: 'Skyr', mealItemId: 3, kcal: 95 }],
      });
    });

    it('leaves the name alone when it is unchanged', async () => {
      const done = firstValueFrom(service.update('5', { name: 'Morgen', items: draft() }));

      answer('POST', `${URL.collection(5)}/items`, {});
      answer('DELETE', `${URL.collection(5)}/items/2`);
      answer('GET', URL.collection(5), MORGEN);
      await done;
    });

    it('fetches the collection again and rethrows when a step fails', async () => {
      const done = firstValueFrom(service.update('5', { name: 'Morgen', items: draft() }));
      http
        .expectOne({ method: 'POST', url: `${URL.collection(5)}/items` })
        .flush(null, { status: 503, statusText: 'Unavailable' });
      // The DELETE never runs, so the API still has both items.
      answer('GET', URL.collection(5), MORGEN);

      await expect(done).rejects.toEqual({ messageKey: 'common.error.server', status: 503 });
      expect(service.collectionById('5')?.items).toHaveLength(2);
    });

    it('names what failed on a rejected step, even when the reload fails too', async () => {
      const done = firstValueFrom(service.update('5', { name: 'Ny', items: draft() }));
      http
        .expectOne({ method: 'PATCH', url: URL.collection(5) })
        .flush(null, { status: 400, statusText: 'Bad Request' });
      http
        .expectOne({ method: 'GET', url: URL.collection(5) })
        .flush(null, { status: 503, statusText: 'Unavailable' });

      await expect(done).rejects.toEqual({ messageKey: 'collections.saveError', status: 400 });
      expect(service.collectionById('5')?.name).toBe('Morgen');
      // Memory may be stale, so the screens offer a full reload instead of an edit from old ids.
      expect(service.status()).toBe('error');
    });

    it('succeeds once every write went through, even when the refresh fails', async () => {
      const done = firstValueFrom(service.update('5', { name: 'Morgen', items: draft() }));
      answer('POST', `${URL.collection(5)}/items`, {});
      answer('DELETE', `${URL.collection(5)}/items/2`);
      http
        .expectOne({ method: 'GET', url: URL.collection(5) })
        .flush(null, { status: 503, statusText: 'Unavailable' });

      await expect(done).resolves.toBeUndefined();
      expect(service.status()).toBe('error');
    });

    it('forgets a collection deleted on another device', async () => {
      const done = firstValueFrom(service.update('5', { name: 'Ny', items: draft() }));
      http
        .expectOne({ method: 'PATCH', url: URL.collection(5) })
        .flush(null, { status: 404, statusText: 'Not Found' });
      http
        .expectOne({ method: 'GET', url: URL.collection(5) })
        .flush(null, { status: 404, statusText: 'Not Found' });

      await expect(done).rejects.toEqual({ messageKey: 'collections.saveError', status: 404 });
      expect(service.collections()).toEqual([]);
      expect(service.status()).toBe('ready');
    });
  });

  it('removes a collection, also when it is already gone', async () => {
    flushTestCollections([MORGEN, testCollection(4, 'Aften', [])]);

    const first = firstValueFrom(service.remove('5'));
    answer('DELETE', URL.collection(5));
    await first;
    const second = firstValueFrom(service.remove('4'));
    http
      .expectOne({ method: 'DELETE', url: URL.collection(4) })
      .flush(null, { status: 404, statusText: 'Not Found' });
    await second;

    expect(service.collections()).toEqual([]);
  });

  it('logs the collection under the meal now and puts the rows in the food log', async () => {
    flushTestCollections([MORGEN]);
    const rows = [
      testFoodLog({ ...TEST_FOOD, name: 'Havregryn', quantity: '60 g' }, 'aften', TEST_NOW, 12),
      testFoodLog({ ...TEST_FOOD, name: 'Proteinbar', quantity: '2 stk' }, 'aften', TEST_NOW, 13),
    ];

    const done = firstValueFrom(service.log('5', 'aften'));
    expect(answer('POST', `${URL.collection(5)}/log`, rows)).toEqual({
      consumedAt: TEST_NOW.toISOString(),
      mealType: 'Dinner',
      multiplier: 1,
    });
    await done;

    expect(
      TestBed.inject(FoodLogService)
        .byMeal()
        .get('aften')
        ?.map((entry) => entry.name),
    ).toEqual(['Havregryn', 'Proteinbar']);
  });

  it('names what failed when the log is rejected and forgets a collection that is gone', async () => {
    flushTestCollections([MORGEN]);

    const done = firstValueFrom(service.log('5', 'snack'));
    http
      .expectOne(`${URL.collection(5)}/log`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    await expect(done).rejects.toEqual({ messageKey: 'collections.logError', status: 404 });
    expect(TestBed.inject(FoodLogService).entries()).toEqual([]);
    expect(service.collections()).toEqual([]);
  });
});
