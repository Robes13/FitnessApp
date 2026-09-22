import { TestBed } from '@angular/core/testing';
import { FoodItem } from '../../../core/models/food';
import { CollectionsService } from '../../../core/services/collections';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { BUNDLE_ID_PREFIX, CollectionsViewService } from './collections-view';

const TUN: FoodItem = {
  id: 'item-tun',
  name: 'Tunsalat',
  quantity: '200 g',
  kcal: 240,
  protein: 28,
  carbs: 6,
  fat: 11,
};
const RUGBROED: FoodItem = {
  id: 'item-rugbroed',
  name: 'Rugbrød',
  quantity: '2 skiver',
  brand: 'Bagerens',
  kcal: 180,
  protein: 6,
  carbs: 34,
  fat: 2,
};

describe('CollectionsViewService', () => {
  let view: CollectionsViewService;
  let collections: CollectionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    view = TestBed.inject(CollectionsViewService);
    collections = TestBed.inject(CollectionsService);
  });

  it('har kun "Alle" som filter, indtil backenden leverer faste samlinger', () => {
    expect(view.chips().map((chip) => chip.label)).toEqual(['Alle']);
    expect(view.chips().at(0)?.id).toBeNull();
  });

  it('er tom, indtil brugeren selv opretter en samling', () => {
    expect(view.entriesFor(null)).toEqual([]);
  });

  it('viser en brugersamling som ét bundt med måltidets farve', () => {
    collections.create({ name: 'Meal prep', icon: 'bag', meal: 'frokost', items: [TUN, RUGBROED] });

    const entries = view.entriesFor(null);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      title: 'Meal prep',
      subtitle: 'Tunsalat, Rugbrød',
      meta: '2 varer',
      tone: 'positive',
      icon: 'bag',
      kcal: 420,
      protein: 34,
    });
    expect(entries.at(0)?.id.startsWith(BUNDLE_ID_PREFIX)).toBe(true);
  });

  it('viser en tom brugersamling med designets reservetekster', () => {
    collections.create({ name: 'Tom', icon: 'star', meal: 'snack', items: [] });

    expect(view.entriesFor(null)[0]).toMatchObject({
      subtitle: 'Ingen varer endnu',
      meta: '0 varer',
      kcal: 0,
    });
  });

  it('slår et bundt-id op og summerer samlingens varer', () => {
    const created = collections.create({
      name: 'Meal prep',
      icon: 'bag',
      meal: 'frokost',
      items: [TUN, RUGBROED],
    });

    const detail = view.detailFor(`${BUNDLE_ID_PREFIX}${created.id}`);

    expect(detail).toMatchObject({
      title: 'Meal prep',
      meal: 'frokost',
      macros: { kcal: 420, protein: 34, carbs: 40, fat: 13 },
    });
    expect(detail?.contents).toEqual([
      { name: 'Tunsalat', quantity: '200 g' },
      { name: 'Rugbrød', quantity: '2 skiver' },
    ]);
  });

  it('slår en løs vare op som en enkelt linje', () => {
    collections.create({
      name: 'Aften',
      icon: 'leaf',
      meal: 'aften',
      items: [TUN],
    });

    expect(view.detailFor(TUN.id)).toMatchObject({
      title: 'Tunsalat',
      meal: 'aften',
      tone: 'selected',
      contents: [{ name: 'Tunsalat', quantity: '200 g' }],
    });
  });

  it('finder kun brugerens egne samlinger som redigerbare', () => {
    const created = collections.create({
      name: 'Aften',
      icon: 'leaf',
      meal: 'aften',
      items: [TUN],
    });

    expect(view.editableCollectionFor(`${BUNDLE_ID_PREFIX}${created.id}`)).toEqual(created);
    expect(view.editableCollectionFor(TUN.id)).toBeNull();
    expect(view.editableCollectionFor(`${BUNDLE_ID_PREFIX}findes-ikke`)).toBeNull();
  });

  it('giver null for et ukendt id', () => {
    expect(view.detailFor('findes-ikke')).toBeNull();
    expect(view.detailFor(`${BUNDLE_ID_PREFIX}findes-ikke`)).toBeNull();
  });
});
