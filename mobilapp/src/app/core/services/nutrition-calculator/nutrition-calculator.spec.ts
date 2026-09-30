import { TestBed } from '@angular/core/testing';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { PACES } from '../../constants/nutrition';
import { UserProfile } from '../../models/profile';
import { TEST_NOW } from '../../testing/test-providers';
import { Translate, injectTranslate } from '../language/translate';
import { NutritionCalculator } from './nutrition-calculator';

/** Test profile: the default profile with training on Monday, Wednesday and Friday. */
const BASE_PROFILE: UserProfile = {
  ...DEFAULT_PROFILE,
  trainingDays: [true, false, true, false, true, false, false],
};

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
      expect(t(calculator.activityLevelFor(20000).labelKey)).toBe('Maratonklar');
    });

    it('clamps steps to the allowed range', () => {
      expect(t(calculator.activityLevelFor(-50).labelKey)).toBe('Stillesiddende');
      expect(t(calculator.activityLevelFor(999999).labelKey)).toBe('Maratonklar');
    });
  });

  describe('training', () => {
    it('counts training days', () => {
      expect(calculator.trainingFrequency(BASE_PROFILE)).toBe(3);
      expect(calculator.trainingFrequency(DEFAULT_PROFILE)).toBe(0);
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

  it("looks up a pace, whose daily kcal is the API's (kg/week × 7700 / 7)", () => {
    expect(calculator.paceFor('moderat')?.kgPerWeek).toBe(0.5);
    expect(calculator.paceFor(null)).toBeNull();
    expect(PACES.map((pace) => pace.kcalPerDay)).toEqual([275, 550, 1100]);
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
