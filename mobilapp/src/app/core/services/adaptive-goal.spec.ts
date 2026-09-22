import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../constants/storage-key';
import { LoggedFood } from '../models/food';
import { WeighEntry } from '../models/weight';
import { createFakeStorage } from '../testing/fake-document';
import { TEST_NOW, provideCoreTestEnvironment } from '../testing/test-providers';
import { addDays, toIsoDate } from '../utils/date-format';
import { AdaptiveGoalService } from './adaptive-goal';
import { UserProfileService } from './user-profile';

/** The default profile (75 kg, 178 cm, 6000 steps, no training) needs 2530 kcal by formula. */
const FORMULA_TARGET = 2530;

function loggedFood(kcal: number, day: Date): LoggedFood {
  return {
    id: 'food-test',
    name: 'Test',
    quantity: '1 portion',
    kcal,
    protein: 0,
    carbs: 0,
    fat: 0,
    logId: `log-${toIsoDate(day)}`,
    meal: 'frokost',
    loggedAt: day.toISOString(),
  };
}

/** One entry of `kcal` on each of the `count` days before today (yesterday first). */
function foodLogDays(count: number, kcal: number): Record<string, readonly LoggedFood[]> {
  const days: Record<string, readonly LoggedFood[]> = {};
  for (let offset = 1; offset <= count; offset += 1) {
    const day = addDays(TEST_NOW, -offset);
    days[toIsoDate(day)] = [loggedFood(kcal, day)];
  }
  return days;
}

function weighIn(daysAgo: number, kg: number): WeighEntry {
  return { id: `w${daysAgo}`, kg, at: addDays(TEST_NOW, -daysAgo).toISOString() };
}

describe('AdaptiveGoalService', () => {
  function setup(seed: Readonly<Record<string, unknown>>): AdaptiveGoalService {
    TestBed.configureTestingModule({
      providers: provideCoreTestEnvironment({ storage: createFakeStorage(seed) }),
    });
    return TestBed.inject(AdaptiveGoalService);
  }

  it('does not adjust without data', () => {
    const service = setup({});

    expect(service.adjustment()).toBeNull();
    expect(service.adjustmentKcal()).toBe(0);
    expect(service.kcalTarget()).toBe(FORMULA_TARGET);
  });

  it('moves the target towards the intake when the weight is stable', () => {
    const service = setup({
      [STORAGE_KEY.FOOD_LOG]: { days: foodLogDays(12, 2410) },
      [STORAGE_KEY.WEIGHT_LOG]: [weighIn(1, 75), weighIn(10, 75), weighIn(20, 75)],
    });

    expect(service.adjustment()).toEqual({ estimatedTdeeKcal: 2410, adjustmentKcal: -120 });
    expect(service.adjustmentKcal()).toBe(-120);
    expect(service.kcalTarget()).toBe(FORMULA_TARGET - 120);
    expect(service.suggestedKcalTarget()).toBe(FORMULA_TARGET - 120);
  });

  it('ignores weigh-ins outside the 21-day window', () => {
    const service = setup({
      [STORAGE_KEY.FOOD_LOG]: { days: foodLogDays(12, 2410) },
      [STORAGE_KEY.WEIGHT_LOG]: [weighIn(1, 75), weighIn(30, 76)],
    });

    expect(service.adjustment()).toBeNull();
    expect(service.kcalTarget()).toBe(FORMULA_TARGET);
  });

  it("ignores today's intake and weigh-ins, which are still being logged", () => {
    const today = { [toIsoDate(TEST_NOW)]: [loggedFood(100, TEST_NOW)] };
    const service = setup({
      [STORAGE_KEY.FOOD_LOG]: { days: { ...foodLogDays(10, 2410), ...today } },
      [STORAGE_KEY.WEIGHT_LOG]: [weighIn(0, 80), weighIn(1, 75), weighIn(20, 75)],
    });

    expect(service.adjustment()?.estimatedTdeeKcal).toBe(2410);
  });

  it('does not count a weigh-in from today as the second weigh-in', () => {
    const service = setup({
      [STORAGE_KEY.FOOD_LOG]: { days: foodLogDays(12, 2410) },
      [STORAGE_KEY.WEIGHT_LOG]: [weighIn(0, 75), weighIn(20, 75)],
    });

    expect(service.adjustment()).toBeNull();
  });

  it('moves the window on at midnight', () => {
    vi.useFakeTimers();
    try {
      const now = new Date(2026, 8, 21, 23, 59, 59);
      const todayLog = { [toIsoDate(now)]: [loggedFood(2410, now)] };
      TestBed.configureTestingModule({
        providers: provideCoreTestEnvironment({
          now,
          storage: createFakeStorage({
            [STORAGE_KEY.FOOD_LOG]: { days: { ...foodLogDays(9, 2410), ...todayLog } },
            [STORAGE_KEY.WEIGHT_LOG]: [weighIn(1, 75), weighIn(20, 75)],
          }),
        }),
      });
      const service = TestBed.inject(AdaptiveGoalService);
      // 9 completed days so far – today's 10th doesn't count yet.
      expect(service.adjustment()).toBeNull();

      now.setDate(22);
      now.setHours(0, 0, 0, 0);
      vi.advanceTimersByTime(1000);

      expect(service.adjustment()?.estimatedTdeeKcal).toBe(2410);
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  it('reports only the part of the adjustment the 1200 kcal floor lets through', () => {
    const service = setup({
      // A small woman losing fast: the formula suggestion is already at the 1200 floor.
      [STORAGE_KEY.PROFILE]: {
        weightKg: 45,
        heightCm: 150,
        gender: 'kvinde',
        stepsPerDay: 0,
        goal: 'tabe',
        pace: 'hurtig',
      },
      [STORAGE_KEY.FOOD_LOG]: { days: foodLogDays(12, 1300) },
      [STORAGE_KEY.WEIGHT_LOG]: [weighIn(1, 45), weighIn(20, 45)],
    });

    expect(service.adjustment()?.adjustmentKcal).toBeLessThan(0);
    expect(service.suggestedKcalTarget()).toBe(1200);
    expect(service.suggestedAdjustmentKcal()).toBe(0);
    expect(service.adjustmentKcal()).toBe(0);
  });

  it('lets a manual target win', () => {
    const service = setup({
      [STORAGE_KEY.FOOD_LOG]: { days: foodLogDays(12, 2410) },
      [STORAGE_KEY.WEIGHT_LOG]: [weighIn(1, 75), weighIn(20, 75)],
    });
    TestBed.inject(UserProfileService).update({ kcalOverride: 1900 });

    expect(service.kcalTarget()).toBe(1900);
    expect(service.adjustmentKcal()).toBe(0);
    expect(service.suggestedKcalTarget()).toBe(FORMULA_TARGET - 120);
  });
});
