import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  flushTestCollections,
  flushTestFoodLog,
  testCollection,
  testFood,
} from '../../../core/testing/fixtures';
import { CollectionsService } from '../../../core/services/collections/collections';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { CollectionsViewService } from './collections-view';

const COLLECTIONS_URL = '/api/v1/me/meal-collections?limit=100';
const MEAL_PREP = testCollection(3, 'Meal prep', [
  { foodId: 1, foodName: 'Tunsalat', quantity: 200, unit: 'Gram' },
  { foodId: 2, foodName: 'Rugbrød', quantity: 2, unit: 'Piece' },
]);

describe('CollectionsViewService', () => {
  let view: CollectionsViewService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    view = TestBed.inject(CollectionsViewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function loadMealPrep(): void {
    flushTestFoodLog([
      testFood({ foodId: 1, name: 'Tunsalat', caloriesPer100: 120, proteinPer100: 14 }),
      testFood({
        foodId: 2,
        name: 'Rugbrød',
        caloriesPer100: 90,
        proteinPer100: 3,
        carbohydratesPer100: 17,
        servings: [{ foodServingId: 1, unit: 'Piece', gramsPerUnit: 100 }],
      }),
    ]);
    flushTestCollections([MEAL_PREP]);
  }

  it('has no rows until the user has a collection', () => {
    expect(view.entries()).toEqual([]);
  });

  it('shows a collection as one bundle with its items and nutrition', () => {
    loadMealPrep();

    expect(view.entries()).toEqual([
      {
        id: '3',
        title: 'Meal prep',
        subtitle: 'Tunsalat, Rugbrød',
        meta: '2 varer',
        macrosText: '420 kcal · 34 g protein',
      },
    ]);
  });

  it('writes kcal from 1000 up with a thousands separator', () => {
    flushTestFoodLog([
      testFood({ foodId: 1, name: 'Tunsalat', caloriesPer100: 120, proteinPer100: 14 }),
    ]);
    flushTestCollections([
      testCollection(4, 'Fest', [
        { foodId: 1, foodName: 'Tunsalat', quantity: 1000, unit: 'Gram' },
      ]),
    ]);

    expect(view.entries()[0]?.macrosText).toBe('1.200 kcal · 140 g protein');
  });

  it('looks up a bundle id and sums its items', () => {
    loadMealPrep();

    const detail = view.detailFor('3');

    expect(detail).toMatchObject({
      title: 'Meal prep',
      subtitle: 'Tunsalat, Rugbrød',
      macros: { kcal: 420, protein: 34, carbs: 34, fat: 0 },
    });
    expect(detail?.contents.map((item) => [item.name, item.quantity])).toEqual([
      ['Tunsalat', '200 g'],
      ['Rugbrød', '2 stk'],
    ]);
    expect(view.collectionFor('3')?.name).toBe('Meal prep');
  });

  it('gives null for an unknown id', () => {
    loadMealPrep();

    expect(view.detailFor('99')).toBeNull();
    expect(view.collectionFor('99')).toBeNull();
  });

  it('fails when a store fails, and "Prøv igen" reloads only that one', () => {
    flushTestFoodLog();
    TestBed.inject(CollectionsService).load().subscribe();
    expect(view.status()).toBe('loading');

    http.expectOne(COLLECTIONS_URL).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(view.status()).toBe('error');

    view.retry();
    expect(view.status()).toBe('loading');
    http.expectOne(COLLECTIONS_URL).flush({ items: [], nextCursor: null, hasMore: false });
    expect(view.status()).toBe('ready');
  });
});
