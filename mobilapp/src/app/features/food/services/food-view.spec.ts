import { TestBed } from '@angular/core/testing';
import { FoodItem } from '../../../core/models/food';
import { FoodLogService } from '../../../core/services/food-log';
import { UserProfileService } from '../../../core/services/user-profile';
import { FakeStorage, createFakeStorage } from '../../../core/testing/fake-document';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { FoodViewService } from './food-view';

/** Fast dagsmål, så makromålene bliver runde tal (150 / 225 / 56 g). */
const KCAL_TARGET = 2000;

/** Én stor vare, der skubber dagen over målet. */
const CAKE: FoodItem = {
  id: 'food-kage',
  name: 'Fødselsdagskage',
  quantity: '1 stk',
  kcal: 2000,
  protein: 10,
  carbs: 240,
  fat: 90,
};

describe('FoodViewService', () => {
  let storage: FakeStorage;

  function setup(): { view: FoodViewService; log: FoodLogService } {
    TestBed.configureTestingModule({
      providers: [...provideCoreTestEnvironment({ storage }), FoodViewService],
    });
    TestBed.inject(UserProfileService).update({ kcalOverride: KCAL_TARGET });
    return { view: TestBed.inject(FoodViewService), log: TestBed.inject(FoodLogService) };
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('sums the seeded demo log against the daily target', () => {
    const { view } = setup();

    expect(view.todayLabel).toBe('Mandag 21. sep');
    expect(view.kcalTarget()).toBe(KCAL_TARGET);
    expect(view.kcalEaten()).toBe(830);
    expect(view.kcalRemaining()).toBe(1170);
    expect(view.kcalLeft()).toBe(1170);
    expect(view.kcalProgress()).toBeCloseTo(0.415, 5);
  });

  it('builds the three macro cards from the 30/45/25 split', () => {
    const { view } = setup();

    expect(view.macroCards()).toEqual([
      expect.objectContaining({ label: 'Protein', percentLabel: '49%', text: '73 / 150 g' }),
      expect.objectContaining({ label: 'Kulhydrat', percentLabel: '25%', text: '56 / 225 g' }),
      expect.objectContaining({ label: 'Fedt', percentLabel: '55%', text: '31 / 56 g' }),
    ]);
  });

  it('groups the log by meal and shows a dash for the empty ones', () => {
    const { view } = setup();

    expect(
      view.mealGroups().map((group) => [group.label, group.kcalText, group.entries.length]),
    ).toEqual([
      ['Morgenmad', '380 kcal', 1],
      ['Frokost', '450 kcal', 1],
      ['Aftensmad', '–', 0],
      ['Snacks', '–', 0],
    ]);
    expect(view.mealGroups()[0]?.addLabel).toBe('+ Tilføj til morgenmad');
  });

  it('caps the ring and the remaining number when the day goes over target', () => {
    const { view, log } = setup();

    log.add(CAKE, 'snack');

    expect(view.kcalEaten()).toBe(2830);
    expect(view.kcalRemaining()).toBe(-830);
    expect(view.kcalLeft()).toBe(0);
    expect(view.kcalProgress()).toBe(1);
    expect(view.macroCards()[1]?.percentLabel).toBe('100%');
  });

  it('names a meal from its id', () => {
    const { view } = setup();

    expect(view.mealLabel('aften')).toBe('Aftensmad');
  });
});
