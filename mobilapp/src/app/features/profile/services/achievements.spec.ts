import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import {
  flushTestGoal,
  flushTestWeighIns,
  testFoodLog,
  weightLogDto,
} from '../../../core/testing/fixtures';
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
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup(): {
    achievements: AchievementsService;
    profiles: UserProfileService;
    foodLog: FoodLogService;
  } {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    return {
      achievements: TestBed.inject(AchievementsService),
      profiles: TestBed.inject(UserProfileService),
      foodLog: TestBed.inject(FoodLogService),
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
    const { achievements } = setup();

    expect(badge(achievements.achievements(), 'first-weigh').progressLabel).toBe('Mangler');

    flushTestWeighIns([weightLogDto(1, 74.2, 0, TEST_NOW)]);
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

    foodLog.addLogs([
      testFoodLog(
        { id: 'x', name: 'Æble', quantity: '1 stk', kcal: 95, protein: 0, carbs: 25, fat: 0 },
        'snack',
      ),
    ]);

    expect(badge(achievements.achievements(), 'meals-10').progressLabel).toBe('1/10 måltider');
  });

  it('starts the kilo badges at nothing lost and writes kilos with a Danish comma', () => {
    const { achievements, profiles } = setup();

    expect(badge(achievements.achievements(), 'lost-2').progressLabel).toBe('0/2 kg');

    // One weigh-in per day: yesterday's 76 kg and today's 74.8 kg – the profile's weight.
    flushTestWeighIns([weightLogDto(2, 74.8, 0, TEST_NOW), weightLogDto(1, 76, 1, TEST_NOW)]);
    profiles.update({ weightKg: 74.8 });

    expect(badge(achievements.achievements(), 'lost-2').progressLabel).toBe('1,2/2 kg');
    expect(badge(achievements.achievements(), 'lost-5').progressLabel).toBe('1,2/5 kg');
  });

  it('completes the weekly badges once the day target is met', () => {
    const { achievements, foodLog, profiles } = setup();
    flushTestGoal();

    expect(badge(achievements.achievements(), 'perfect-week').progressLabel).toBe('0/7 dage');

    // Only today has data, so one full daily goal is all the week can count.
    foodLog.addLogs([
      testFoodLog(
        {
          id: 'y',
          name: 'Stor dag',
          quantity: '1 portion',
          kcal: profiles.targets().kcal,
          protein: 300,
          carbs: 0,
          fat: 0,
        },
        'aften',
      ),
    ]);

    expect(badge(achievements.achievements(), 'perfect-week').progressLabel).toBe('1/7 dage');
    expect(badge(achievements.achievements(), 'protein-5').progressLabel).toBe('1/5 dage');
    expect(badge(achievements.achievements(), 'streak-7').progressLabel).toBe('1/7 dage');
  });

  it('counts no protein day before the goal has loaded', () => {
    const { achievements } = setup();

    expect(badge(achievements.achievements(), 'protein-5').progressLabel).toBe('0/5 dage');
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
