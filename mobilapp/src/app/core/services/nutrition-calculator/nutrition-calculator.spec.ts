import { TestBed } from '@angular/core/testing';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { PACES } from '../../constants/nutrition';
import { DailyFoodTotals } from '../../models/food';
import { PaceDefinition, UserProfile } from '../../models/profile';
import { WeighEntry } from '../../models/weight';
import { TEST_NOW } from '../../testing/test-providers';
import { Translate, injectTranslate } from '../language/translate';
import { NutritionCalculator } from './nutrition-calculator';

/** Test profile: the default profile with training on Monday, Wednesday and Friday. */
const BASE_PROFILE: UserProfile = {
  ...DEFAULT_PROFILE,
  trainingDays: [true, false, true, false, true, false, false],
};

const MODERAT = PACES.find((pace) => pace.id === 'moderat') as PaceDefinition;
const HURTIG = PACES.find((pace) => pace.id === 'hurtig') as PaceDefinition;

/** `count` days with one entry of `kcal` each (plus `emptyDays` days without a log). */
function loggedDays(count: number, kcal: number, emptyDays = 0): DailyFoodTotals[] {
  const logged = Array.from({ length: count }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    totals: { kcal, protein: 0, carbs: 0, fat: 0 },
    entryCount: 1,
  }));
  const empty = Array.from({ length: emptyDays }, () => ({
    date: '2026-08-01',
    totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    entryCount: 0,
  }));
  return [...logged, ...empty];
}

function weighIn(day: number, kg: number): WeighEntry {
  return { id: `w${day}`, kg, at: new Date(2026, 8, day, 7).toISOString() };
}

describe('NutritionCalculator', () => {
  let calculator: NutritionCalculator;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    calculator = TestBed.inject(NutritionCalculator);
  });

  describe('ageFromBirthday', () => {
    it('returns 0 for missing or invalid dates', () => {
      expect(calculator.ageFromBirthday(null, TEST_NOW)).toBe(0);
      expect(calculator.ageFromBirthday('', TEST_NOW)).toBe(0);
      expect(calculator.ageFromBirthday('ikke-en-dato', TEST_NOW)).toBe(0);
    });

    it('counts completed years', () => {
      expect(calculator.ageFromBirthday('1998-05-16', TEST_NOW)).toBe(28);
    });

    it('does not count the year before the birthday has passed', () => {
      expect(calculator.ageFromBirthday('1998-09-22', TEST_NOW)).toBe(27);
      expect(calculator.ageFromBirthday('1998-09-21', TEST_NOW)).toBe(28);
    });

    it('never returns a negative age', () => {
      expect(calculator.ageFromBirthday('2030-01-01', TEST_NOW)).toBe(0);
    });
  });

  describe('bmi', () => {
    it('rounds to one decimal', () => {
      expect(calculator.bmi(75, 178)).toBe(23.7);
    });

    it('is 0 without a height', () => {
      expect(calculator.bmi(75, 0)).toBe(0);
    });
  });

  describe('bmr (Mifflin-St Jeor)', () => {
    it('adds 5 for men', () => {
      expect(calculator.bmr(75, 178, 28, 'mand')).toBe(1727.5);
    });

    it('subtracts 161 for women', () => {
      expect(calculator.bmr(75, 178, 28, 'kvinde')).toBe(1561.5);
    });

    it('uses the average of the two formulas for "andet" and unknown gender', () => {
      expect(calculator.bmr(75, 178, 28, 'andet')).toBe(1644.5);
      expect(calculator.bmr(75, 178, 28, null)).toBe(1644.5);
    });

    it('falls back to 30 years when the age is unknown', () => {
      expect(calculator.bmr(75, 178, 0, 'mand')).toBe(1717.5);
    });
  });

  describe('activityLevelFor', () => {
    let t: Translate;

    beforeEach(() => {
      t = TestBed.runInInjectionContext(() => injectTranslate());
    });

    it('picks the first level whose upper bound is above the steps', () => {
      expect(t(calculator.activityLevelFor(0).labelKey)).toBe('Stillesiddende');
      expect(t(calculator.activityLevelFor(2499).labelKey)).toBe('Stillesiddende');
      expect(t(calculator.activityLevelFor(2500).labelKey)).toBe('Let aktiv');
      expect(t(calculator.activityLevelFor(6000).labelKey)).toBe('Aktiv');
      expect(calculator.activityLevelFor(6000).pal).toBe(1.55);
      expect(t(calculator.activityLevelFor(20000).labelKey)).toBe('Maratonklar');
    });

    it('clamps steps to the allowed range', () => {
      expect(t(calculator.activityLevelFor(-50).labelKey)).toBe('Stillesiddende');
      expect(t(calculator.activityLevelFor(999999).labelKey)).toBe('Maratonklar');
    });
  });

  it('baseKcal rounds to the nearest 10 kcal', () => {
    expect(calculator.baseKcal(1727.5, 1.55)).toBe(2680);
  });

  describe('goalAdjustment', () => {
    it('subtracts the pace for losing, adds it for gaining and is 0 for maintaining', () => {
      expect(calculator.goalAdjustment('tabe', MODERAT)).toBe(-500);
      expect(calculator.goalAdjustment('tage', HURTIG)).toBe(1000);
      expect(calculator.goalAdjustment('hold', MODERAT)).toBe(0);
    });

    it('is 0 without a pace or goal', () => {
      expect(calculator.goalAdjustment('tabe', null)).toBe(0);
      expect(calculator.goalAdjustment(null, MODERAT)).toBe(0);
    });
  });

  describe('exerciseKcalPerDay', () => {
    it('is 0 without training days', () => {
      expect(calculator.exerciseKcalPerDay(DEFAULT_PROFILE)).toBe(0);
    });

    it('uses the net MET of the intensity: days × minutes × (MET − 1) × kg / 60 / 7', () => {
      // 3 × 45 min × (5 − 1) × 75 kg / 60 / 7 – no RPE falls back to moderate.
      expect(calculator.exerciseKcalPerDay(BASE_PROFILE)).toBeCloseTo(96.43, 2);
      // RPE 3 = mild, MET 3.5.
      expect(calculator.exerciseKcalPerDay({ ...BASE_PROFILE, trainingRpe: 3 })).toBeCloseTo(
        60.27,
        2,
      );
      // RPE 9 = hard, MET 8.
      expect(calculator.exerciseKcalPerDay({ ...BASE_PROFILE, trainingRpe: 9 })).toBeCloseTo(
        168.75,
        2,
      );
    });
  });

  describe('maintenanceKcal', () => {
    it('equals BMR × PAL without training days', () => {
      expect(calculator.maintenanceKcal(DEFAULT_PROFILE, TEST_NOW)).toBe(2530);
    });

    it('adds the training expenditure and rounds to 10 kcal', () => {
      // 1634.5 × 1.55 + 96.43 = 2629.9
      expect(calculator.maintenanceKcal(BASE_PROFILE, TEST_NOW)).toBe(2630);
    });
  });

  describe('kcalTarget', () => {
    it('computes the default profile without training to 2530 kcal', () => {
      expect(calculator.kcalTarget(DEFAULT_PROFILE, TEST_NOW)).toBe(2530);
    });

    it('includes training: three moderate 45-minute sessions a week give 2630 kcal', () => {
      expect(calculator.kcalTarget(BASE_PROFILE, TEST_NOW)).toBe(2630);
    });

    it('applies the goal adjustment', () => {
      const profile: UserProfile = { ...BASE_PROFILE, goal: 'tabe', pace: 'hurtig' };
      expect(calculator.kcalTarget(profile, TEST_NOW)).toBe(1630);
    });

    it('adds the adaptive adjustment', () => {
      expect(calculator.kcalTarget(BASE_PROFILE, TEST_NOW, -120)).toBe(2510);
      expect(calculator.suggestedKcalTarget(BASE_PROFILE, TEST_NOW, 150)).toBe(2780);
    });

    it('prefers a manual override, also over the adaptive adjustment', () => {
      const profile: UserProfile = { ...BASE_PROFILE, kcalOverride: 1800 };
      expect(calculator.kcalTarget(profile, TEST_NOW)).toBe(1800);
      expect(calculator.kcalTarget(profile, TEST_NOW, -300)).toBe(1800);
      expect(calculator.suggestedKcalTarget(profile, TEST_NOW)).toBe(2630);
    });

    it('never goes below 1200 kcal', () => {
      const profile: UserProfile = {
        ...BASE_PROFILE,
        weightKg: 30,
        heightCm: 120,
        gender: 'kvinde',
        birthday: '1966-01-01',
        stepsPerDay: 0,
        goal: 'tabe',
        pace: 'hurtig',
      };
      expect(calculator.kcalTarget(profile, TEST_NOW)).toBe(1200);
    });

    it('keeps the 1200 kcal floor with a negative adaptive adjustment', () => {
      const profile: UserProfile = { ...BASE_PROFILE, goal: 'tabe', pace: 'hurtig' };
      expect(calculator.kcalTarget(profile, TEST_NOW, -300)).toBe(1330);
      const light: UserProfile = { ...profile, weightKg: 45, heightCm: 150, gender: 'kvinde' };
      expect(calculator.kcalTarget(light, TEST_NOW, -300)).toBe(1200);
    });
  });

  describe('adaptiveAdjustment', () => {
    const stableWeight = [weighIn(1, 80), weighIn(8, 80), weighIn(15, 80)];

    it('is null with fewer than 10 logged days', () => {
      expect(
        calculator.adaptiveAdjustment({
          formulaTdeeKcal: 2500,
          dailyTotals: loggedDays(9, 2300, 12),
          weighIns: stableWeight,
        }),
      ).toBeNull();
    });

    it('is null with fewer than 2 weigh-ins or a span under 14 days', () => {
      const dailyTotals = loggedDays(14, 2300);
      expect(
        calculator.adaptiveAdjustment({
          formulaTdeeKcal: 2500,
          dailyTotals,
          weighIns: [weighIn(1, 80)],
        }),
      ).toBeNull();
      expect(
        calculator.adaptiveAdjustment({
          formulaTdeeKcal: 2500,
          dailyTotals,
          weighIns: [weighIn(1, 80), weighIn(14, 79)],
        }),
      ).toBeNull();
    });

    it('with a stable weight, the average intake is the actual expenditure', () => {
      // Empty days are ignored: the average is over logged days only.
      expect(
        calculator.adaptiveAdjustment({
          formulaTdeeKcal: 2500,
          dailyTotals: loggedDays(10, 2380, 11),
          weighIns: stableWeight,
        }),
      ).toEqual({ estimatedTdeeKcal: 2380, adjustmentKcal: -120 });
    });

    it('leaves out partly logged days below half the formula expenditure', () => {
      // 10 full days at 2400 plus 5 days with only breakfast (400 < 2500 × 0.5).
      const breakfastOnly = loggedDays(5, 400).map((day, index) => ({
        ...day,
        date: `2026-08-${String(index + 10)}`,
      }));
      expect(
        calculator.adaptiveAdjustment({
          formulaTdeeKcal: 2500,
          dailyTotals: [...loggedDays(10, 2400), ...breakfastOnly],
          weighIns: stableWeight,
        }),
      ).toEqual({ estimatedTdeeKcal: 2400, adjustmentKcal: -100 });
      // …and they don't count towards the 10 logged days either.
      expect(
        calculator.adaptiveAdjustment({
          formulaTdeeKcal: 2500,
          dailyTotals: [...loggedDays(9, 2400), ...breakfastOnly],
          weighIns: stableWeight,
        }),
      ).toBeNull();
    });

    it('adds the energy of the weight lost to the intake', () => {
      // −1 kg over 14 days: 2000 + 1 × 7700 / 14 = 2550 (the order of weigh-ins does not matter).
      expect(
        calculator.adaptiveAdjustment({
          formulaTdeeKcal: 2400,
          dailyTotals: loggedDays(14, 2000),
          weighIns: [weighIn(15, 79), weighIn(1, 80)],
        }),
      ).toEqual({ estimatedTdeeKcal: 2550, adjustmentKcal: 150 });
    });

    it('limits the adjustment to ±300 kcal', () => {
      const gaining = calculator.adaptiveAdjustment({
        formulaTdeeKcal: 2500,
        dailyTotals: loggedDays(14, 3000),
        weighIns: [weighIn(1, 80), weighIn(15, 80)],
      });
      expect(gaining?.adjustmentKcal).toBe(300);
      const eatingLittle = calculator.adaptiveAdjustment({
        formulaTdeeKcal: 2500,
        dailyTotals: loggedDays(14, 1500),
        weighIns: [weighIn(1, 80), weighIn(15, 80)],
      });
      expect(eatingLittle?.adjustmentKcal).toBe(-300);
    });
  });

  it('macroGoals splits 30/45/25 into grams', () => {
    expect(calculator.macroGoals(2000)).toEqual({ kcal: 2000, protein: 150, carbs: 225, fat: 56 });
  });

  describe('training', () => {
    it('counts training days and multiplies with the duration', () => {
      expect(calculator.trainingFrequency(BASE_PROFILE)).toBe(3);
      expect(calculator.weeklyTrainingMinutes(BASE_PROFILE)).toBe(135);
    });

    it('clamps the duration to 10..180 minutes', () => {
      expect(calculator.weeklyTrainingMinutes({ ...BASE_PROFILE, trainingMinutes: 5 })).toBe(30);
    });

    it('maps RPE to an intensity', () => {
      expect(calculator.intensityFor(null)).toBeNull();
      expect(calculator.intensityFor(3)?.id).toBe('mildt');
      expect(calculator.intensityFor(4)?.id).toBe('mildt');
      expect(calculator.intensityFor(5)?.id).toBe('moderat');
      expect(calculator.intensityFor(7)?.id).toBe('moderat');
      expect(calculator.intensityFor(8)?.id).toBe('haardt');
      expect(calculator.intensityFor(10)?.id).toBe('haardt');
      expect(calculator.intensityFor(15)?.id).toBe('haardt');
      expect(calculator.intensityFor(0)?.id).toBe('mildt');
    });
  });

  it('converts steps to km and kcal', () => {
    expect(calculator.stepsToKm(6000)).toBeCloseTo(4.5);
    expect(calculator.stepsToKcal(6000, 75)).toBe(203);
  });

  describe('goalWeightBounds', () => {
    it('starts just above the current weight when gaining', () => {
      expect(calculator.goalWeightBounds('tage', 75)).toEqual({ min: 76, max: 200 });
    });

    it('stops just below the current weight when losing or maintaining', () => {
      expect(calculator.goalWeightBounds('tabe', 75)).toEqual({ min: 35, max: 74 });
      expect(calculator.goalWeightBounds('hold', 75.4)).toEqual({ min: 35, max: 74 });
      expect(calculator.goalWeightBounds(null, 75)).toEqual({ min: 35, max: 74 });
    });

    it('keeps at least one kg of range for very light users', () => {
      expect(calculator.goalWeightBounds('tabe', 36)).toEqual({ min: 35, max: 36 });
    });
  });

  describe('isGoalWeightRealistic', () => {
    it('requires BMI >= 17 when losing', () => {
      expect(calculator.isGoalWeightRealistic('tabe', 50, 178)).toBe(false);
      expect(calculator.isGoalWeightRealistic('tabe', 55, 178)).toBe(true);
    });

    it('requires BMI <= 35 when gaining', () => {
      expect(calculator.isGoalWeightRealistic('tage', 120, 178)).toBe(false);
      expect(calculator.isGoalWeightRealistic('tage', 100, 178)).toBe(true);
    });

    it('is always realistic when maintaining', () => {
      expect(calculator.isGoalWeightRealistic('hold', 300, 150)).toBe(true);
      expect(calculator.isGoalWeightRealistic(null, 30, 250)).toBe(true);
    });
  });

  describe('passwordStrength', () => {
    it('is empty for an empty password', () => {
      expect(calculator.passwordStrength('')).toEqual({
        score: 0,
        percent: 0,
        label: '',
        tone: 'muted',
      });
    });

    it('scores length, a capital letter and a digit', () => {
      expect(calculator.passwordStrength('abc')).toMatchObject({ score: 0, label: 'Svag' });
      expect(calculator.passwordStrength('abcdefghij')).toMatchObject({
        score: 1,
        percent: 30,
        label: 'Svag',
        tone: 'negative',
      });
      expect(calculator.passwordStrength('Abcdefghij')).toMatchObject({
        score: 2,
        percent: 55,
        label: 'OK',
        tone: 'accent',
      });
      expect(calculator.passwordStrength('Abcdefghi1')).toMatchObject({
        score: 3,
        percent: 80,
        label: 'God',
        tone: 'warning',
      });
      expect(calculator.passwordStrength('Abcdefghijk1')).toMatchObject({
        score: 4,
        percent: 100,
        label: 'Stærk',
        tone: 'positive',
      });
    });

    it('accepts Danish capital letters', () => {
      expect(calculator.passwordStrength('Æbleflæsk1').score).toBe(3);
    });
  });

  it('isValidEmail matches the design pattern', () => {
    expect(calculator.isValidEmail('dig@mail.dk')).toBe(true);
    expect(calculator.isValidEmail('dig@mail')).toBe(false);
    expect(calculator.isValidEmail('mail.dk')).toBe(false);
    expect(calculator.isValidEmail('')).toBe(false);
  });

  it('scaleMacros rounds every macro', () => {
    expect(calculator.scaleMacros({ kcal: 380, protein: 32, carbs: 38, fat: 9 }, 0.5)).toEqual({
      kcal: 190,
      protein: 16,
      carbs: 19,
      fat: 5,
    });
  });

  describe('parseQuantity', () => {
    it('splits amount and unit', () => {
      expect(calculator.parseQuantity('250 g')).toEqual({ amount: 250, unit: 'g' });
      expect(calculator.parseQuantity('1 portion')).toEqual({ amount: 1, unit: 'portion' });
      expect(calculator.parseQuantity('2 stk')).toEqual({ amount: 2, unit: 'stk' });
      expect(calculator.parseQuantity('55g')).toEqual({ amount: 55, unit: 'g' });
    });

    it('understands Danish decimal commas', () => {
      expect(calculator.parseQuantity('0,5 l')).toEqual({ amount: 0.5, unit: 'l' });
    });

    it('defaults to 1 and grams', () => {
      expect(calculator.parseQuantity('portion')).toEqual({ amount: 1, unit: 'portion' });
      expect(calculator.parseQuantity('')).toEqual({ amount: 1, unit: 'g' });
      expect(calculator.parseQuantity('½ stk')).toEqual({ amount: 1, unit: '½ stk' });
    });
  });
});
