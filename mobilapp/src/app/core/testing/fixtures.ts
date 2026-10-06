import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MEAL_TYPE_BY_MEAL } from '../constants/meals';
import { MS_PER_DAY } from '../constants/time';
import { CursorPage } from '../models/api';
import { AuthResponse } from '../models/auth';
import { FoodItem } from '../models/food';
import { FoodDto, FoodLogDto, MealCollectionDto, MealItemDto } from '../models/food-api';
import { MealId } from '../models/meal';
import { UserGoalDto } from '../models/profile-api';
import { SessionState } from '../models/session';
import { WeightLogDto } from '../models/weight';
import { CollectionsService } from '../services/collections/collections';
import { FoodLogService } from '../services/food-log/food-log';
import { toApiUnit } from '../services/food-log/food-log-mapping';
import { UserProfileService } from '../services/user-profile/user-profile';
import { WeightLogService } from '../services/weight-log/weight-log';
import { toIsoDate } from '../utils/date-format';
import { TEST_NOW } from './test-providers';

/** A weigh-in as the API sends it, `daysAgo` days before `now` at the same time of day. */
export function weightLogDto(id: number, kg: number, daysAgo: number, now: Date): WeightLogDto {
  const at = new Date(now.getTime() - daysAgo * MS_PER_DAY);
  return { weightLogId: id, weight: kg, recordedAt: at.toISOString(), recordedDate: toIsoDate(at) };
}

/**
 * Three weigh-ins to test with, newest first: 75.0 kg 3 days ago (id 1), 75.6 kg 10 days ago
 * (id 2) and 76.1 kg 20 days ago (id 3). Give them to the store with `flushTestWeighIns()`.
 */
export function weighHistory(now: Date): readonly WeightLogDto[] {
  return [
    weightLogDto(1, 75, 3, now),
    weightLogDto(2, 75.6, 10, now),
    weightLogDto(3, 76.1, 20, now),
  ];
}

/**
 * Gives `WeightLogService` weigh-ins the way the API does: `load()` answered with `weighIns` (one
 * page). Needs `HttpTestingController` (every spec has it). The profile's weight is not touched.
 */
export function flushTestWeighIns(weighIns: readonly WeightLogDto[]): void {
  TestBed.inject(WeightLogService).load().subscribe();
  TestBed.inject(HttpTestingController)
    .expectOne('/api/v1/me/weight-logs?limit=100')
    .flush({ items: weighIns, nextCursor: null, hasMore: false });
}

/** An item to log in tests. */
export const TEST_FOOD: FoodItem = {
  id: 'food-proteinbar',
  name: 'Proteinbar',
  quantity: '55 g',
  kcal: 210,
  protein: 20,
  carbs: 22,
  fat: 7,
};

/** A food in the user's catalogue as the API returns it: per 100 g, no servings unless given. */
export function testFood(food: Pick<FoodDto, 'foodId' | 'name'> & Partial<FoodDto>): FoodDto {
  return {
    barcode: null,
    caloriesPer100: 0,
    proteinPer100: 0,
    carbohydratesPer100: 0,
    fatPer100: 0,
    createdByUserId: 1,
    createdAt: '2026-09-01T08:00:00Z',
    servings: [],
    ...food,
  };
}

let nextFoodLogId = 1;

/**
 * `food` logged under `meal` as the API returns it: `quantity` and the macros as consumed.
 * Put it into the store with `FoodLogService.addLogs()`. Every row gets its own `foodLogId`; read
 * it from the row, never assume a number – the counter is shared by all spec files (non-isolated).
 */
export function testFoodLog(
  food: FoodItem,
  meal: MealId,
  consumedAt: Date = TEST_NOW,
  foodId = 1,
): FoodLogDto {
  const [amount = '1', token = 'g'] = food.quantity.split(' ');
  return {
    foodLogId: nextFoodLogId++,
    foodId,
    foodName: food.name,
    quantity: Number(amount),
    unit: toApiUnit(token),
    caloriesConsumed: food.kcal,
    proteinConsumed: food.protein,
    carbohydratesConsumed: food.carbs,
    fatConsumed: food.fat,
    consumedAt: consumedAt.toISOString(),
    mealType: MEAL_TYPE_BY_MEAL[meal],
  };
}

/** Loads `FoodLogService` as the API answers it: `foods` as the catalogue and `logs` as the log. */
export function flushTestFoodLog(
  foods: readonly FoodDto[] = [],
  logs: readonly FoodLogDto[] = [],
): void {
  const page = <T>(items: readonly T[]): CursorPage<T> => ({
    items: [...items],
    nextCursor: null,
    hasMore: false,
  });
  TestBed.inject(FoodLogService).load().subscribe();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne({ method: 'GET', url: '/api/v1/foods?limit=100' }).flush(page(foods));
  http
    .expectOne((request) => request.method === 'GET' && request.url === '/api/v1/me/food-logs')
    .flush(page(logs));
}

/**
 * A meal collection as the API returns it. Its items get `mealItemId` 1, 2, … unless given; the
 * nutrition comes from the foods in `FoodLogService.foods`, so `totals` is left at 0.
 */
export function testCollection(
  mealCollectionId: number,
  name: string,
  items: readonly (Omit<MealItemDto, 'mealItemId'> & Partial<Pick<MealItemDto, 'mealItemId'>>)[],
): MealCollectionDto {
  return {
    mealCollectionId,
    name,
    createdAt: '2026-09-20T08:00:00Z',
    items: items.map((item, index) => ({ mealItemId: index + 1, ...item })),
    totals: { calories: 0, protein: 0, carbohydrates: 0, fat: 0 },
  };
}

/** Loads `CollectionsService` as the API answers it (one page). */
export function flushTestCollections(collections: readonly MealCollectionDto[]): void {
  TestBed.inject(CollectionsService).load().subscribe();
  TestBed.inject(HttpTestingController)
    .expectOne({ method: 'GET', url: '/api/v1/me/meal-collections?limit=100' })
    .flush({ items: [...collections], nextCursor: null, hasMore: false });
}

/** The account of the auth fixtures below. */
export const TEST_EMAIL = 'mads@nutrify.dk';

/** A `login`/`refresh` response whose tokens are valid long after `TEST_NOW`. */
export const TEST_AUTH_RESPONSE: AuthResponse = {
  accessToken: 'test-access-token',
  accessTokenExpiresAt: '2099-01-01T00:00:00Z',
  refreshToken: 'test-refresh-token',
  refreshTokenExpiresAt: '2099-01-31T00:00:00Z',
  user: {
    userId: 1,
    email: TEST_EMAIL,
    username: 'mads',
    isActive: true,
    emailVerifiedAt: '2026-09-01T08:00:00Z',
    createdAt: '2026-09-01T07:55:00Z',
  },
};

/** A signed-in session to seed as `STORAGE_KEY.SESSION`, with the tokens of `TEST_AUTH_RESPONSE`. */
export const AUTHENTICATED_SESSION: SessionState = {
  status: 'authenticated',
  email: TEST_EMAIL,
  userId: TEST_AUTH_RESPONSE.user.userId,
  tokens: {
    accessToken: TEST_AUTH_RESPONSE.accessToken,
    accessTokenExpiresAt: TEST_AUTH_RESPONSE.accessTokenExpiresAt,
    refreshToken: TEST_AUTH_RESPONSE.refreshToken,
    refreshTokenExpiresAt: TEST_AUTH_RESPONSE.refreshTokenExpiresAt,
  },
};

/** Stored by `register` (e-mail not verified yet). Restored after a restart, it is a guest. */
export const PENDING_SESSION: SessionState = {
  status: 'pending-verification',
  email: TEST_EMAIL,
  userId: TEST_AUTH_RESPONSE.user.userId,
  tokens: null,
};

/** Logged out after `AUTHENTICATED_SESSION`: the e-mail and the account id are remembered. */
export const SIGNED_OUT_SESSION: SessionState = {
  status: 'guest',
  email: TEST_EMAIL,
  userId: TEST_AUTH_RESPONSE.user.userId,
  tokens: null,
};

/** A goal as the API answers it: 2500 kcal, 30/40/30 → targets 2500 kcal, 188 / 250 / 83 g. */
export const TEST_GOAL: UserGoalDto = {
  userGoalId: 7,
  goalType: 'LoseWeight',
  targetWeight: 70,
  weightChangePerWeek: 0.5,
  targetDailyCalories: 2500,
  targetProtein: 187.5,
  targetCarbohydrates: 250,
  targetFat: 83.33,
  createdAt: '2026-09-01T07:55:00Z',
};

/**
 * Gives `UserProfileService` a goal (and so its `targets`) the way the API does: `reloadGoal()`
 * answered with `goal`. Needs `HttpTestingController` (every spec has it).
 */
export function flushTestGoal(goal: UserGoalDto = TEST_GOAL): void {
  TestBed.inject(UserProfileService).reloadGoal().subscribe();
  TestBed.inject(HttpTestingController).expectOne('/api/v1/me/goals/current').flush(goal);
}
