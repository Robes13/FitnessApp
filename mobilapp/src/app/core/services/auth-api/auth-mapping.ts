import { HttpStatusCode } from '@angular/common/http';
import { AUTH_ERROR_MESSAGE_KEY } from '../../constants/auth';
import { TRAINING_FALLBACK_INTENSITY } from '../../constants/nutrition';
import { ApiGender, ApiGoalType, ApiTrainingIntensity, RegisterRequest } from '../../models/auth';
import { Gender, GoalId, IntensityId, UserProfile } from '../../models/profile';
import { ApiErrorResolver } from '../../utils/api';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';

export const GENDER_TO_API: Readonly<Record<Gender, ApiGender>> = {
  mand: 'Male',
  kvinde: 'Female',
  andet: 'Other',
};

export const GOAL_TO_API: Readonly<Record<GoalId, ApiGoalType>> = {
  tabe: 'LoseWeight',
  hold: 'MaintainWeight',
  tage: 'GainWeight',
};

export const INTENSITY_TO_API: Readonly<Record<IntensityId, ApiTrainingIntensity>> = {
  mildt: 'Low',
  moderat: 'Moderate',
  haardt: 'High',
};

const MAINTAIN_GOAL: GoalId = 'hold';
const USERNAME_DETAIL = /username/i;

/**
 * The sign-up draft as the API's flat `RegisterRequest`, with the app's own rules from
 * `NutritionCalculator`. The API keeps less than the app: the seven training days become a
 * count, and the RPE becomes one of three intensities (`TRAINING_FALLBACK_INTENSITY` without
 * training days or RPE – the API requires one). Maintaining sends neither goal weight nor pace.
 */
export function toRegisterRequest(
  profile: UserProfile,
  password: string,
  passwordConfirmation: string,
  timeZoneId: string,
  calculator: NutritionCalculator,
): RegisterRequest {
  const trainingDaysPerWeek = calculator.trainingFrequency(profile);
  const intensity: IntensityId =
    (trainingDaysPerWeek > 0 ? calculator.intensityFor(profile.trainingRpe)?.id : undefined) ??
    TRAINING_FALLBACK_INTENSITY;
  const goal = profile.goal ?? MAINTAIN_GOAL;
  const maintains = goal === MAINTAIN_GOAL;
  return {
    email: profile.email.trim(),
    username: profile.username.trim(),
    password,
    passwordConfirmation,
    birthDate: profile.birthday ?? '',
    gender: profile.gender === null ? 'Unspecified' : GENDER_TO_API[profile.gender],
    startingWeight: profile.weightKg,
    height: profile.heightCm,
    dailySteps: profile.stepsPerDay,
    trainingDaysPerWeek,
    workoutDurationMinutes: profile.trainingMinutes,
    trainingIntensity: INTENSITY_TO_API[intensity],
    goalType: GOAL_TO_API[goal],
    targetWeight: maintains ? null : profile.goalWeightKg,
    weightChangePerWeek: maintains ? null : (calculator.paceFor(profile.pace)?.kgPerWeek ?? null),
    notificationsEnabled: profile.notificationsEnabled,
    // Registering is only possible from the summary, whose button requires the terms checkbox.
    acceptedTerms: true,
    timeZoneId,
  };
}

/** Register: the two 409s differ only in their English `detail`. */
export const registerErrorKey: ApiErrorResolver = ({ status, detail, fields }) => {
  if (status === HttpStatusCode.Conflict) {
    return USERNAME_DETAIL.test(detail ?? '')
      ? AUTH_ERROR_MESSAGE_KEY.USERNAME_TAKEN
      : AUTH_ERROR_MESSAGE_KEY.EMAIL_TAKEN;
  }
  if (status !== HttpStatusCode.BadRequest) {
    return null;
  }
  if (fields.includes('password')) {
    return AUTH_ERROR_MESSAGE_KEY.PASSWORD_TOO_SHORT;
  }
  return fields.includes('email')
    ? AUTH_ERROR_MESSAGE_KEY.INVALID_EMAIL
    : AUTH_ERROR_MESSAGE_KEY.REGISTER_FAILED;
};

/**
 * Login: 401 (wrong identifier or password – the API doesn't say which) and 400 (a value the API
 * rejects outright, e.g. over 200 characters) are wrong credentials; 429 is the lockout. The 403
 * of an unverified e-mail keeps the generic key: `SessionService.login()` turns it into the
 * pending state instead of an error.
 */
export const loginErrorKey: ApiErrorResolver = ({ status }) => {
  switch (status) {
    case HttpStatusCode.Unauthorized:
    case HttpStatusCode.BadRequest:
      return AUTH_ERROR_MESSAGE_KEY.INVALID_CREDENTIALS;
    case HttpStatusCode.TooManyRequests:
      return AUTH_ERROR_MESSAGE_KEY.TOO_MANY_ATTEMPTS;
    default:
      return null;
  }
};
