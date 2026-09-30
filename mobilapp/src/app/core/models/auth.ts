/** The API's enum values (C# member names; the API reads them case-insensitively). */
export type ApiGender = 'Unspecified' | 'Male' | 'Female' | 'Other' | 'PreferNotToSay';
export type ApiTrainingIntensity = 'Low' | 'Moderate' | 'High';
export type ApiGoalType = 'LoseWeight' | 'MaintainWeight' | 'GainWeight';

/**
 * Body of `POST auth/register` – flat, exactly as the API expects. Registration creates the
 * profile, the first goal, the `Notifications` setting and the terms consent in one go.
 */
export interface RegisterRequest {
  email: string;
  /** 3–50 characters, unique. */
  username: string;
  /** 10–200 characters. */
  password: string;
  passwordConfirmation: string;
  /** `YYYY-MM-DD`; age 13–100. */
  birthDate: string;
  gender: ApiGender;
  /** kg, 25–400. */
  startingWeight: number;
  /** cm, 100–250. */
  height: number;
  dailySteps: number;
  trainingDaysPerWeek: number;
  workoutDurationMinutes: number;
  trainingIntensity: ApiTrainingIntensity;
  goalType: ApiGoalType;
  /** Below `startingWeight` to lose, above to gain; `null` (ignored) to maintain. */
  targetWeight: number | null;
  /** kg per week, 0 < x ≤ 1; `null` to maintain. */
  weightChangePerWeek: number | null;
  notificationsEnabled: boolean;
  /** Must be `true`. */
  acceptedTerms: boolean;
  /** IANA id, e.g. `Europe/Copenhagen`. */
  timeZoneId: string;
}

/** The account, as `register`, `login` and `GET me` return it. */
export interface UserDto {
  userId: number;
  email: string;
  username: string;
  /** `false` until the e-mail is verified. */
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

/** Body of `login`. With an `@` it is an e-mail (the API lower-cases it), else a username. */
export interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

/**
 * Response of `login` and `refresh`. `refresh` always issues a new access token; the refresh
 * token stays the same when it was issued the same UTC day, otherwise it is rotated (30 days).
 */
export interface AuthResponse {
  accessToken: string;
  /** UTC ISO; 15 minutes after issue. */
  accessTokenExpiresAt: string;
  refreshToken: string;
  /** UTC ISO; 30 days after issue. */
  refreshTokenExpiresAt: string;
  user: UserDto;
}

/** Body of `refresh` and `logout`. */
export interface RefreshRequest {
  refreshToken: string;
}

/** Body of `email/resend-verification` and `password/forgot`: an e-mail or a username. */
export interface IdentifierRequest {
  emailOrUsername: string;
}
