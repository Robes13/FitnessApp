import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../../constants/storage-key';
import { FoodCollection, FoodItem } from '../../models/food';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { CollectionsService, DuplicateCollectionNameError } from './collections';

const BANAN: FoodItem = {
  id: 'food-banan',
  name: 'Banan',
  quantity: '1 stk',
  kcal: 105,
  protein: 1,
  carbs: 27,
  fat: 0,
};

const BASE: FoodCollection = {
  id: 'base-morgen',
  name: 'Morgenmad',
  icon: 'egg',
  meal: 'morgen',
  isBase: true,
  recipeIds: [],
  items: [],
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

  it('finds an item across the collections', () => {
    const service = setup();
    service.create({ name: 'Snacks', icon: 'bag', meal: 'snack', items: [BANAN] });

    expect(service.itemById(BANAN.id)?.name).toBe('Banan');
    expect(service.itemById('ukendt')).toBeUndefined();
  });

  it('rejects a duplicate name, trimmed and case-insensitive', () => {
    const service = setup();
    service.create({ name: 'Meal prep', icon: 'star', meal: 'frokost', items: [] });

    expect(service.isNameTaken('  MEAL prep ')).toBe(true);
    expect(service.isNameTaken('Meal prep 2')).toBe(false);
    expect(() =>
      service.create({ name: ' meal PREP', icon: 'bag', meal: 'aften', items: [] }),
    ).toThrow(DuplicateCollectionNameError);
    expect(service.collections()).toHaveLength(1);
  });

  it('updates a user collection and persists it', () => {
    const service = setup();
    const created = service.create({ name: 'Aften', icon: 'leaf', meal: 'aften', items: [] });

    const updated = service.update(created.id, {
      name: ' Frokost ',
      icon: 'bag',
      meal: 'frokost',
      items: [BANAN],
    });

    expect(updated).toEqual({
      ...created,
      name: 'Frokost',
      icon: 'bag',
      meal: 'frokost',
      items: [BANAN],
    });
    expect(service.collectionById(created.id)).toEqual(updated);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.COLLECTIONS) ?? '{}')).toMatchObject({
      collections: [{ id: created.id, name: 'Frokost', items: [BANAN] }],
    });
  });

  it('lets a collection keep its own name but not take another one', () => {
    const service = setup();
    const first = service.create({ name: 'Aften', icon: 'leaf', meal: 'aften', items: [] });
    service.create({ name: 'Frokost', icon: 'bag', meal: 'frokost', items: [] });

    expect(service.isNameTaken('aften', first.id)).toBe(false);
    expect(service.update(first.id, { ...first, name: 'AFTEN' })?.name).toBe('AFTEN');
    expect(() => service.update(first.id, { ...first, name: 'frokost' })).toThrow(
      DuplicateCollectionNameError,
    );
    expect(service.collectionById(first.id)?.name).toBe('AFTEN');
  });

  it('removes a user collection and persists it', () => {
    const service = setup();
    const created = service.create({ name: 'Aften', icon: 'leaf', meal: 'aften', items: [] });

    expect(service.remove(created.id)).toBe(true);
    expect(service.collections()).toEqual([]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.COLLECTIONS) ?? '{}')).toEqual({
      collections: [],
    });
    expect(service.remove(created.id)).toBe(false);
  });

  it('never edits or deletes a base collection', () => {
    storage.setItem(STORAGE_KEY.COLLECTIONS, JSON.stringify({ collections: [BASE] }));
    const service = setup();

    expect(service.update(BASE.id, { ...BASE, name: 'Ændret' })).toBeNull();
    expect(service.remove(BASE.id)).toBe(false);
    expect(service.collections()).toEqual([BASE]);
  });

  it('ignores unknown ids on update', () => {
    const service = setup();

    expect(
      service.update('findes-ikke', { name: 'X', icon: 'bag', meal: 'snack', items: [] }),
    ).toBeNull();
    expect(service.collections()).toEqual([]);
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
