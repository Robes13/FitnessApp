import { TestBed } from '@angular/core/testing';
import { addDays } from '../../../core/utils/date-format';
import { FoodLogService } from '../../../core/services/food-log';
import { UserProfileService } from '../../../core/services/user-profile';
import { WeightLogService } from '../../../core/services/weight-log';
import { TEST_NOW, provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { Achievement, AchievementsService } from './achievements';

function badge(list: readonly Achievement[], id: string): Achievement {
  const found = list.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Ukendt badge: ${id}`);
  }
  return found;
}

describe('AchievementsService', () => {
  function setup(): {
    achievements: AchievementsService;
    profiles: UserProfileService;
    foodLog: FoodLogService;
    weightLog: WeightLogService;
  } {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    return {
      achievements: TestBed.inject(AchievementsService),
      profiles: TestBed.inject(UserProfileService),
      foodLog: TestBed.inject(FoodLogService),
      weightLog: TestBed.inject(WeightLogService),
    };
  }

  it('lists the twelve badges from the design in order', () => {
    const { achievements } = setup();

    expect(achievements.achievements().map((item) => item.label)).toEqual([
      '7 dages streak',
      'Første vejning',
      '10 måltider',
      '2 kg tabt',
      'Protein-mål 5x',
      'Egen samling',
      '30 dages streak',
      '50 måltider',
      '5 kg tabt',
      '10 scanninger',
      'Ingen sen snack',
      'Perfekt uge',
    ]);
  });

  it('marks the first weigh-in as missing until the user has weighed', () => {
    const { achievements, weightLog } = setup();

    expect(badge(achievements.achievements(), 'first-weigh').progressLabel).toBe('Mangler');

    weightLog.add(74.2);
    const weigh = badge(achievements.achievements(), 'first-weigh');

    expect(weigh.complete).toBe(true);
    expect(weigh.progress).toBe(1);
    expect(weigh.progressLabel).toBe('Klaret');
  });

  it('says "Mangler" for a one-step badge that is not reached', () => {
    const { achievements } = setup();

    expect(badge(achievements.achievements(), 'own-collection').progressLabel).toBe('Mangler');
  });

  it('counts the meals the user has logged', () => {
    const { achievements, foodLog } = setup();

    expect(badge(achievements.achievements(), 'meals-10').progressLabel).toBe('0/10 måltider');

    foodLog.add(
      { id: 'x', name: 'Æble', quantity: '1 stk', kcal: 95, protein: 0, carbs: 25, fat: 0 },
      'snack',
    );

    expect(badge(achievements.achievements(), 'meals-10').progressLabel).toBe('1/10 måltider');
  });

  it('starts the kilo badges at nothing lost and writes kilos with a Danish comma', () => {
    const { achievements, weightLog } = setup();

    expect(badge(achievements.achievements(), 'lost-2').progressLabel).toBe('0/2 kg');

    // One weigh-in per day: yesterday's 76 kg and today's 74.8 kg.
    weightLog.add(76, addDays(TEST_NOW, -1));
    weightLog.add(74.8);

    expect(badge(achievements.achievements(), 'lost-2').progressLabel).toBe('1,2/2 kg');
    expect(badge(achievements.achievements(), 'lost-5').progressLabel).toBe('1,2/5 kg');
  });

  it('completes the weekly badges once the day target is met', () => {
    const { achievements, foodLog, profiles } = setup();

    expect(badge(achievements.achievements(), 'perfect-week').progressLabel).toBe('0/7 dage');

    // Only today has data, so one full daily goal is all the week can count.
    foodLog.add(
      {
        id: 'y',
        name: 'Stor dag',
        quantity: '1 portion',
        kcal: profiles.kcalTarget(),
        protein: 300,
        carbs: 0,
        fat: 0,
      },
      'aften',
    );

    expect(badge(achievements.achievements(), 'perfect-week').progressLabel).toBe('1/7 dage');
    expect(badge(achievements.achievements(), 'protein-5').progressLabel).toBe('1/5 dage');
    expect(badge(achievements.achievements(), 'streak-7').progressLabel).toBe('1/7 dage');
  });

  it('gives every badge a tone the progress ring understands', () => {
    const { achievements } = setup();

    for (const item of achievements.achievements()) {
      expect(['accent', 'positive', 'info', 'negative', 'neutral']).toContain(item.tone);
      expect(item.progress).toBeGreaterThanOrEqual(0);
      expect(item.progress).toBeLessThanOrEqual(1);
    }
  });
});
