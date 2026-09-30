import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthResponse } from '../models/auth';
import { FoodItem } from '../models/food';
import { UserGoalDto } from '../models/profile-api';
import { SessionState } from '../models/session';
import { WeightLogDto } from '../models/weight';
import { UserProfileService } from '../services/user-profile/user-profile';
import { WeightLogService } from '../services/weight-log/weight-log';
import { toIsoDate } from '../utils/date-format';

const MS_PER_DAY = 86_400_000;

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

/** Registered, but the e-mail isn't verified yet – Home shows the verification sheet. */
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
