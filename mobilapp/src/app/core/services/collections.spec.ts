import { TestBed } from '@angular/core/testing';
import { FOOD_DATABASE } from '../constants/demo-data';
import { STORAGE_KEY } from '../constants/storage-key';
import { FoodCollection, FoodItem } from '../models/food';
import { FakeStorage, createFakeStorage } from '../testing/fake-document';
import { provideCoreTestEnvironment } from '../testing/test-providers';
import { CollectionsService } from './collections';

const BANAN = FOOD_DATABASE[2] as FoodItem;

describe('CollectionsService', () => {
  let storage: FakeStorage;

  function setup(): CollectionsService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    return TestBed.inject(CollectionsService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('exposes the eight recipes and four base collections', () => {
    const service = setup();

    expect(service.recipes).toHaveLength(8);
    expect(service.collections().map((collection) => collection.id)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
    ]);
    expect(service.baseCollections()).toHaveLength(4);
    expect(service.userCollections()).toEqual([]);
    expect(service.recipeById('laks')?.title).toBe('Ovnlaks med rodfrugter');
    expect(service.recipeById('nope')).toBeUndefined();
    expect(service.collectionById('c2')?.name).toBe('Frokost');
  });

  it('finds the base collection a recipe belongs to, falling back to the first', () => {
    const service = setup();

    expect(service.collectionForRecipe('laks').id).toBe('c3');
    expect(service.collectionForRecipe('hummus').id).toBe('c4');
    expect(service.collectionForRecipe('unknown').id).toBe('c1');
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
    expect(service.collections()).toHaveLength(5);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.COLLECTIONS) ?? '{}')).toMatchObject({
      userCollections: [{ id: created.id }],
    });
  });

  it('adds items to base and user collections', () => {
    const service = setup();
    const created = service.create({
      name: 'Snacks til farten',
      icon: 'bag',
      meal: 'snack',
      items: [],
    });

    service.addItem('c1', BANAN);
    service.addItem(created.id, { ...BANAN, id: 'banan-2' });
    service.addItem('findes-ikke', BANAN);

    expect(service.collectionById('c1')?.items).toEqual([BANAN]);
    expect(service.collectionById(created.id)?.items.map((item) => item.id)).toEqual(['banan-2']);
    expect(service.itemById('banan-2')?.name).toBe('Banan');
    expect(service.itemById('ukendt')).toBeUndefined();
    expect(JSON.parse(storage.getItem(STORAGE_KEY.COLLECTIONS) ?? '{}')).toMatchObject({
      baseItems: { c1: [{ id: BANAN.id }] },
    });
  });

  it('restores user collections and base items from storage', () => {
    const custom: FoodCollection = {
      id: 'c-x',
      name: 'Gemt',
      icon: 'leaf',
      meal: 'aften',
      isBase: false,
      recipeIds: [],
      items: [],
    };
    storage.setItem(
      STORAGE_KEY.COLLECTIONS,
      JSON.stringify({ userCollections: [custom], baseItems: { c4: [BANAN] } }),
    );

    const service = setup();

    expect(service.userCollections()).toEqual([custom]);
    expect(service.collectionById('c4')?.items).toEqual([BANAN]);
  });

  it('sums recipes as one portion each plus loose items', () => {
    const service = setup();
    const morgenmad = service.collectionById('c1') as FoodCollection;

    expect(service.collectionTotals(morgenmad)).toEqual({
      kcal: 800,
      protein: 61,
      carbs: 44,
      fat: 42,
      count: 2,
    });

    service.addItem('c1', BANAN);
    const withItem = service.collectionById('c1') as FoodCollection;
    expect(service.collectionTotals(withItem)).toMatchObject({ kcal: 905, count: 3 });
  });
});
