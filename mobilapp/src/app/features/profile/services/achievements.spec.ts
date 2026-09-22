import { TestBed } from '@angular/core/testing';
import { FoodLogService } from '../../../core/services/food-log';
import { UserProfileService } from '../../../core/services/user-profile';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
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

  it('marks the first weigh-in as done, because the log is seeded', () => {
    const { achievements } = setup();
    const weigh = badge(achievements.achievements(), 'first-weigh');

    expect(weigh.complete).toBe(true);
    expect(weigh.progress).toBe(1);
    expect(weigh.progressLabel).toBe('Klaret');
  });

  it('says "Mangler" for a one-step badge that is not reached', () => {
    const { achievements } = setup();

    expect(badge(achievements.achievements(), 'own-collection').progressLabel).toBe('Mangler');
  });

  it('counts logged meals on top of the demo head start', () => {
    const { achievements, foodLog } = setup();

    expect(badge(achievements.achievements(), 'meals-10').progressLabel).toBe('8/10 måltider');

    foodLog.add(
      { id: 'x', name: 'Æble', quantity: '1 stk', kcal: 95, protein: 0, carbs: 25, fat: 0 },
      'snack',
    );

    expect(badge(achievements.achievements(), 'meals-10').progressLabel).toBe('9/10 måltider');
  });

  it('writes kilos with a Danish comma and keeps the design floor', () => {
    const { achievements } = setup();

    expect(badge(achievements.achievements(), 'lost-2').progressLabel).toBe('1,2/2 kg');
    expect(badge(achievements.achievements(), 'lost-5').progressLabel).toBe('1,2/5 kg');
  });

  it('completes the weekly badges once the day target is met', () => {
    const { achievements, foodLog, profiles } = setup();

    expect(badge(achievements.achievements(), 'perfect-week').progressLabel).toBe('0/7 dage');

    // Mandag er ugens eneste dag i testen, så ét fuldt dagsmål rammer hele ugen.
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
    expect(badge(achievements.achievements(), 'streak-7').progressLabel).toBe('4/7 dage');
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
