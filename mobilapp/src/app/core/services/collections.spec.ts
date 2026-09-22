import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../constants/storage-key';
import { FoodCollection, FoodItem } from '../models/food';
import { FakeStorage, createFakeStorage } from '../testing/fake-document';
import { provideCoreTestEnvironment } from '../testing/test-providers';
import { CollectionsService } from './collections';

const BANAN: FoodItem = {
  id: 'food-banan',
  name: 'Banan',
  quantity: '1 stk',
  kcal: 105,
  protein: 1,
  carbs: 27,
  fat: 0,
};

describe('CollectionsService', () => {
  let storage: FakeStorage;

  function setup(): CollectionsService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    return TestBed.inject(CollectionsService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('has no recipes and no collections until a backend delivers them', () => {
    const service = setup();

    expect(service.recipes).toEqual([]);
    expect(service.collections()).toEqual([]);
    expect(service.baseCollections()).toEqual([]);
    expect(service.userCollections()).toEqual([]);
    expect(service.recipeById('laks')).toBeUndefined();
    expect(service.collectionById('c1')).toBeUndefined();
    expect(service.collectionForRecipe('laks')).toBeNull();
  });

  it('creates a user collection and persists it', () => {
    const service = setup();

    const created = service.create({
      name: '  Meal prep ',
      icon: 'star',
      meal: 'frokost',
      items: [BANAN],
    });

    expect(created).toMatchObject({
      name: 'Meal prep',
      icon: 'star',
      meal: 'frokost',
      isBase: false,
    });
    expect(created.id).toMatch(/^c-/);
    expect(created.items).toEqual([BANAN]);
    expect(service.userCollections()).toEqual([created]);
    expect(service.collections()).toHaveLength(1);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.COLLECTIONS) ?? '{}')).toMatchObject({
      collections: [{ id: created.id }],
    });
  });

  it('adds items to a collection and ignores an unknown id', () => {
    const service = setup();
    const created = service.create({
      name: 'Snacks til farten',
      icon: 'bag',
      meal: 'snack',
      items: [],
    });

    service.addItem(created.id, { ...BANAN, id: 'banan-2' });
    service.addItem('findes-ikke', BANAN);

    expect(service.collectionById(created.id)?.items.map((item) => item.id)).toEqual(['banan-2']);
    expect(service.itemById('banan-2')?.name).toBe('Banan');
    expect(service.itemById('ukendt')).toBeUndefined();
  });

  it('restores collections from storage', () => {
    const custom: FoodCollection = {
      id: 'c-x',
      name: 'Gemt',
      icon: 'leaf',
      meal: 'aften',
      isBase: false,
      recipeIds: [],
      items: [BANAN],
    };
    storage.setItem(STORAGE_KEY.COLLECTIONS, JSON.stringify({ collections: [custom] }));

    const service = setup();

    expect(service.userCollections()).toEqual([custom]);
    expect(service.collectionById('c-x')?.items).toEqual([BANAN]);
  });

  it('sums the loose items of a collection', () => {
    const service = setup();
    const created = service.create({
      name: 'Aften',
      icon: 'leaf',
      meal: 'aften',
      items: [BANAN, { ...BANAN, id: 'banan-2' }],
    });

    expect(service.collectionTotals(created)).toEqual({
      kcal: 210,
      protein: 2,
      carbs: 54,
      fat: 0,
      count: 2,
    });
  });
});
