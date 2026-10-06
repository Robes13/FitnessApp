import { INTENSITIES, PACES } from '../../constants/nutrition';
import { NOTIFICATIONS_SETTING_KEY } from '../../constants/profile';
import { DAYS_PER_WEEK } from '../../constants/time';
import { ApiGender, ApiGoalType, ApiTrainingIntensity, UserDto } from '../../models/auth';
import {
  Gender,
  GoalId,
  IntensityId,
  PaceId,
  ProfilePhoto,
  UserProfile,
} from '../../models/profile';
import {
  LatestWeightDto,
  UserGoalDto,
  UserProfileDto,
  UserSettingDto,
} from '../../models/profile-api';
import { resolveApiUrl } from '../../utils/api';
import { GOAL_TO_API, INTENSITY_TO_API } from '../auth-api/auth-mapping';

/** The inverse of `GENDER_TO_API`. The API's "not chosen" values are the app's `null`. */
export const GENDER_FROM_API: Readonly<Record<ApiGender, Gender | null>> = {
  Unspecified: null,
  Male: 'mand',
  Female: 'kvinde',
  Other: 'andet',
  PreferNotToSay: null,
};

/** The inverse of `GOAL_TO_API`. */
export const GOAL_FROM_API = Object.fromEntries(
  Object.entries(GOAL_TO_API).map(([goal, api]) => [api, goal]),
) as Readonly<Record<ApiGoalType, GoalId>>;

/** The inverse of `INTENSITY_TO_API`. */
export const INTENSITY_FROM_API = Object.fromEntries(
  Object.entries(INTENSITY_TO_API).map(([intensity, api]) => [api, intensity]),
) as Readonly<Record<ApiTrainingIntensity, IntensityId>>;

/** The uploaded photo is already a square crop: shown as it is, centred and unzoomed. */
const UPLOADED_PHOTO_CROP: Omit<ProfilePhoto, 'dataUrl'> = {
  aspectRatio: 1,
  zoom: 1,
  x: 50,
  y: 50,
};

/** What `UserProfileService.load()` fetches in parallel. */
export interface ProfileApiParts {
  readonly user: UserDto;
  readonly profile: UserProfileDto;
  readonly goal: UserGoalDto;
  readonly settings: readonly UserSettingDto[];
  readonly latest: LatestWeightDto;
}

type ProfileFields =
  | 'birthday'
  | 'gender'
  | 'heightCm'
  | 'stepsPerDay'
  | 'trainingDays'
  | 'trainingMinutes'
  | 'trainingRpe'
  | 'photo';

/** The whole profile from the API – nothing is kept from the device. */
export function toUserProfile(parts: ProfileApiParts, apiBaseUrl: string): UserProfile {
  return {
    username: parts.user.username,
    email: parts.user.email,
    ...toProfileFields(parts.profile, apiBaseUrl),
    weightKg: parts.latest.weight,
    ...toGoalFields(parts.goal),
    notificationsEnabled: notificationsEnabledIn(parts.settings),
  };
}

/**
 * `UserProfileDto` as profile fields. The API keeps less than the app: the training days become
 * the first N weekdays, the intensity its RPE (3/6/9), and the photo URL a centred crop.
 * Unknown enum values become "not chosen".
 */
export function toProfileFields(
  dto: UserProfileDto,
  apiBaseUrl: string,
): Pick<UserProfile, ProfileFields> {
  const intensity = INTENSITY_FROM_API[dto.trainingIntensity];
  return {
    birthday: dto.birthDate,
    gender: GENDER_FROM_API[dto.gender] ?? null,
    heightCm: dto.height,
    stepsPerDay: dto.dailySteps,
    trainingDays: trainingDaysFor(dto.trainingDaysPerWeek),
    trainingMinutes: dto.workoutDurationMinutes,
    trainingRpe: INTENSITIES.find((item) => item.id === intensity)?.rpe ?? null,
    photo: toProfilePhoto(dto.profileImageUrl, apiBaseUrl),
  };
}

/**
 * The API's `profileImageUrl` as the profile's photo: a centred, unzoomed square. A relative URL
 * (Development) is resolved against `API_BASE_URL`, so the native apps load it from the API.
 */
export function toProfilePhoto(url: string | null, apiBaseUrl: string): ProfilePhoto | null {
  return url === null ? null : { dataUrl: resolveApiUrl(url, apiBaseUrl), ...UPLOADED_PHOTO_CROP };
}

/**
 * A goal (`UserGoalDto` or the `CreateUserGoalRequest` it was made from) as profile fields:
 * maintaining has no pace; the pace is the nearest of `PACES`.
 */
export function toGoalFields(
  goal: Pick<UserGoalDto, 'goalType' | 'targetWeight' | 'weightChangePerWeek'>,
): Pick<UserProfile, 'goal' | 'pace' | 'goalWeightKg'> {
  return {
    goal: GOAL_FROM_API[goal.goalType] ?? null,
    pace: paceIdFor(goal.weightChangePerWeek),
    goalWeightKg: goal.targetWeight,
  };
}

/** The nearest pace by kg per week; `null` for 0 (maintaining). */
export function paceIdFor(kgPerWeek: number): PaceId | null {
  if (kgPerWeek <= 0) {
    return null;
  }
  const distance = (kg: number): number => Math.abs(kg - kgPerWeek);
  return PACES.reduce((best, pace) =>
    distance(pace.kgPerWeek) < distance(best.kgPerWeek) ? pace : best,
  ).id;
}

/** The first `count` weekdays (Monday first) are training days – the API only keeps the count. */
export function trainingDaysFor(count: number): readonly boolean[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => index < count);
}

/** The `Notifications` setting; on when it is missing, as at sign-up. */
export function notificationsEnabledIn(settings: readonly UserSettingDto[]): boolean {
  const setting = settings.find((item) => item.settingKey === NOTIFICATIONS_SETTING_KEY);
  return setting === undefined || setting.settingValue === String(true);
}
