import { QUANTITY_UNIT_BY_TOKEN, TOKEN_BY_QUANTITY_UNIT } from '../../constants/food';
import { MEAL_BY_MEAL_TYPE, MEAL_IDS, MEAL_TYPE_BY_MEAL } from '../../constants/meals';
import { ApiQuantityUnit, FoodLogDto } from '../../models/food-api';
import { testFood } from '../../testing/fixtures';
import { toApiUnit, toFoodItem, toLoggedFood, toPer100 } from './food-log-mapping';

const MACROS = { kcal: 450, protein: 30, carbs: 45, fat: 15 };

const LOG: FoodLogDto = {
  foodLogId: 88,
  foodId: 12,
  foodName: 'Skyr',
  quantity: 150,
  unit: 'Gram',
  caloriesConsumed: 94.5,
  proteinConsumed: 16.49,
  carbohydratesConsumed: 6,
  fatConsumed: 0.3,
  consumedAt: '2026-09-21T08:30:00.1234567Z',
  mealType: 'Lunch',
};

describe('food-log-mapping', () => {
  describe('toPer100', () => {
    it('scales grams and millilitres to 100', () => {
      const per100 = {
        caloriesPer100: 300,
        proteinPer100: 20,
        carbohydratesPer100: 30,
        fatPer100: 10,
      };

      expect(toPer100({ ...MACROS, amount: 150, unit: 'g' })).toEqual(per100);
      expect(toPer100({ ...MACROS, amount: 150, unit: 'ml' })).toEqual(per100);
    });

    it('divides pieces and portions by the amount (per unit) with two decimals', () => {
      expect(toPer100({ ...MACROS, amount: 2, unit: 'stk' })).toEqual({
        caloriesPer100: 225,
        proteinPer100: 15,
        carbohydratesPer100: 22.5,
        fatPer100: 7.5,
      });
      expect(toPer100({ ...MACROS, kcal: 100, amount: 3, unit: 'portion' }).caloriesPer100).toBe(
        33.33,
      );
    });
  });

  describe('toFoodItem', () => {
    const base = { foodId: 12, name: 'Havregryn', caloriesPer100: 370, proteinPer100: 13.3 };

    it.each<[ApiQuantityUnit | null, number, string, number, number]>([
      [null, 1, '100 g', 370, 13],
      ['Milliliter', 1, '100 ml', 370, 13],
      ['Piece', 100, '1 stk', 370, 13],
      ['Serving', 100, '1 portion', 370, 13],
      ['Serving', 40, '1 portion', 148, 5],
    ])(
      'shows a food with a %s serving of %d g as "%s"',
      (unit, gramsPerUnit, quantity, kcal, protein) => {
        const servings = unit === null ? [] : [{ foodServingId: 1, unit, gramsPerUnit }];

        expect(toFoodItem(testFood({ ...base, servings }))).toEqual({
          id: '12',
          name: 'Havregryn',
          quantity,
          kcal,
          protein,
          carbs: 0,
          fat: 0,
          isCustom: true,
        });
      },
    );

    it('prefers a portion over a millilitre serving', () => {
      const food = testFood({
        ...base,
        servings: [
          { foodServingId: 1, unit: 'Milliliter', gramsPerUnit: 1 },
          { foodServingId: 2, unit: 'Serving', gramsPerUnit: 100 },
        ],
      });

      expect(toFoodItem(food).quantity).toBe('1 portion');
    });
  });

  describe('toLoggedFood', () => {
    it('keeps the exact consumed values and reads the meal and time', () => {
      expect(toLoggedFood(LOG)).toEqual({
        logId: '88',
        id: '12',
        name: 'Skyr',
        quantity: '150 g',
        kcal: 94.5,
        protein: 16.49,
        carbs: 6,
        fat: 0.3,
        meal: 'frokost',
        loggedAt: '2026-09-21T08:30:00.123Z',
        isCustom: true,
      });
    });

    it('shows units the app never creates lower-cased', () => {
      expect(toLoggedFood({ ...LOG, quantity: 2, unit: 'Tablespoon' }).quantity).toBe(
        '2 tablespoon',
      );
    });
  });

  it('maps every unit and meal both ways', () => {
    for (const [unit, token] of Object.entries(TOKEN_BY_QUANTITY_UNIT)) {
      expect(QUANTITY_UNIT_BY_TOKEN[token]).toBe(unit);
      expect(toApiUnit(token)).toBe(unit);
    }
    expect(toApiUnit('g')).toBe('Gram');
    expect(toApiUnit('stk')).toBe('Piece');
    expect(toApiUnit('portion')).toBe('Serving');
    expect(toApiUnit('varer')).toBe('Serving');
    for (const meal of MEAL_IDS) {
      expect(MEAL_BY_MEAL_TYPE[MEAL_TYPE_BY_MEAL[meal]]).toBe(meal);
    }
    expect(MEAL_TYPE_BY_MEAL.frokost).toBe('Lunch');
  });
});
