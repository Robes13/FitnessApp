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

  it('lists "Alle" plus the four base collections as filter chips', () => {
    expect(view.chips().map((chip) => chip.label)).toEqual([
      'Alle',
      'Morgenmad',
      'Frokost',
      'Aftensmad',
      'Snacks',
    ]);
    expect(view.chips().at(0)?.id).toBeNull();
  });

  it('shows every recipe when no filter is selected', () => {
    const entries = view.entriesFor(null);

    expect(entries).toHaveLength(8);
    expect(entries[0]).toMatchObject({
      id: 'skyr',
      title: 'Skyr-bowl med bær og nødder',
      meta: 'Morgenmad · 5 min',
      tone: 'accent',
      kcal: 380,
      protein: 32,
    });
    expect(entries.map((entry) => entry.tone)).toEqual([
      'accent',
      'accent',
      'positive',
      'positive',
      'selected',
      'selected',
      'negative',
      'negative',
    ]);
  });

  it('keeps only the selected collection’s recipes when a chip is picked', () => {
    const entries = view.entriesFor('c2');

    expect(entries.map((entry) => entry.id)).toEqual(['kylsalat', 'wrap']);
  });

  it('puts a user collection first as one bundle and follows the meal tint', () => {
    collections.create({ name: 'Meal prep', icon: 'bag', meal: 'frokost', items: [TUN, RUGBROED] });

    const entries = view.entriesFor(null);

    expect(entries[0]).toMatchObject({
      title: 'Meal prep',
      subtitle: 'Tunsalat, Rugbrød',
      meta: 'Frokost · 2 varer',
      tone: 'positive',
      icon: 'bag',
      kcal: 420,
      protein: 34,
    });
    expect(entries.at(0)?.id.startsWith(BUNDLE_ID_PREFIX)).toBe(true);
    expect(entries).toHaveLength(9);
  });

  it('shows an empty user collection with the design’s fallback texts', () => {
    collections.create({ name: 'Tom', icon: 'star', meal: 'snack', items: [] });

    expect(view.entriesFor(null)[0]).toMatchObject({
      subtitle: 'Ingen varer endnu',
      meta: 'Snacks · 0 varer',
      kcal: 0,
    });
  });

  it('filters user collections by the meal of the selected chip', () => {
    collections.create({ name: 'Meal prep', icon: 'bag', meal: 'frokost', items: [TUN] });

    expect(view.entriesFor('c2').map((entry) => entry.title)).toEqual([
      'Meal prep',
      'Kyllingesalat med kikærter',
      'Tunwrap med rødkål',
    ]);
    expect(view.entriesFor('c1').map((entry) => entry.title)).toEqual([
      'Skyr-bowl med bær og nødder',
      'Omelet med spinat og feta',
    ]);
  });

  it('lists a loose item in a base collection as its own row', () => {
    collections.addItem('c1', RUGBROED);

    const entries = view.entriesFor('c1');

    expect(entries[0]).toMatchObject({
      id: RUGBROED.id,
      title: 'Rugbrød',
      subtitle: 'Bagerens',
      meta: 'Morgenmad · 2 skiver',
      tone: 'accent',
    });
  });

  it('resolves a recipe id to its ingredients', () => {
    const detail = view.detailFor('skyr');

    expect(detail).toMatchObject({
      title: 'Skyr-bowl med bær og nødder',
      meal: 'morgen',
      tone: 'accent',
      icon: 'egg',
      macros: { kcal: 380, protein: 32, carbs: 38, fat: 11 },
    });
    expect(detail?.contents).toHaveLength(5);
  });

  it('resolves a bundle id to the collection’s items and totals', () => {
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

  it('resolves a loose item id to a one-line detail', () => {
    collections.addItem('c3', TUN);

    expect(view.detailFor(TUN.id)).toMatchObject({
      title: 'Tunsalat',
      meal: 'aften',
      tone: 'selected',
      contents: [{ name: 'Tunsalat', quantity: '200 g' }],
    });
  });

  it('returns null for an unknown id or a base collection bundle', () => {
    expect(view.detailFor('findes-ikke')).toBeNull();
    expect(view.detailFor(`${BUNDLE_ID_PREFIX}c1`)).toBeNull();
  });
});
