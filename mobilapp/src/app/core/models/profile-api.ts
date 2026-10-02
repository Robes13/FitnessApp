import { ApiGender, ApiGoalType, ApiTrainingIntensity } from './auth';

/** `GET`/`PATCH me/profile`. Decimals arrive as JSON numbers. */
export interface UserProfileDto {
  userProfileId: number;
  userId: number;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  gender: ApiGender;
  /** cm, 100–250. */
  height: number;
  /** kg, from sign-up. */
  startingWeight: number;
  dailySteps: number;
  trainingDaysPerWeek: number;
  workoutDurationMinutes: number;
  trainingIntensity: ApiTrainingIntensity;
  timeZoneId: string;
  profileImageUrl: string | null;
}

/**
 * Body of `PATCH me/profile`: only the fields sent change. The API validates the whole profile
 * (age 13–100, height 100–250 cm) and recalculates the current goal.
 */
export type PatchUserProfileRequest = Partial<
  Pick<
    UserProfileDto,
    | 'birthDate'
    | 'gender'
    | 'height'
    | 'dailySteps'
    | 'trainingDaysPerWeek'
    | 'workoutDurationMinutes'
    | 'trainingIntensity'
    | 'timeZoneId'
  >
>;

/** The calorie and macro targets the API calculated for a goal (`GoalCalculator`). */
export interface UserGoalDto {
  userGoalId: number;
  goalType: ApiGoalType;
  /** kg; the current weight for `MaintainWeight`. */
  targetWeight: number;
  /** kg per week; 0 for `MaintainWeight`. */
  weightChangePerWeek: number;
  targetDailyCalories: number;
  /** grams. */
  targetProtein: number;
  targetCarbohydrates: number;
  targetFat: number;
  createdAt: string;
}

/**
 * Body of `POST me/goals`. `MaintainWeight` needs the server's current weight and pace 0; losing
 * and gaining need a target on the right side of it and a pace above 0. 409 = the current goal
 * already matches.
 */
export interface CreateUserGoalRequest {
  goalType: ApiGoalType;
  targetWeight: number;
  weightChangePerWeek: number;
}

/** One row of `GET me/settings`. The key is the API's `SettingKey` name (`'Notifications'` …). */
export interface UserSettingDto {
  settingKey: string;
  settingValue: string;
  updatedAt: string;
}

/** Body of `PUT me/settings/{key}`. Boolean settings are `'true'` / `'false'`. */
export interface UpsertUserSettingRequest {
  value: string;
}

/** `GET me/weight-logs/latest`: the newest weigh-in, or the starting weight without one. */
export interface LatestWeightDto {
  weightLogId: number | null;
  weight: number;
  recordedAt: string;
  isStartingWeight: boolean;
}
