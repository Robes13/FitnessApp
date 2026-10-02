import { TestBed } from '@angular/core/testing';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { UserProfile } from '../../models/profile';
import { ApiProblem } from '../../utils/api';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';
import { loginErrorKey, registerErrorKey, toRegisterRequest } from './auth-mapping';

const PROFILE: UserProfile = {
  ...DEFAULT_PROFILE,
  username: ' mads ',
  email: ' mads@nutrify.dk ',
  birthday: '1998-05-16',
  gender: 'mand',
  weightKg: 75.5,
  heightCm: 178,
  stepsPerDay: 6000,
  trainingDays: [true, false, true, false, true, false, false],
  trainingMinutes: 45,
  trainingRpe: 6,
  goal: 'tabe',
  pace: 'moderat',
  goalWeightKg: 70,
  notificationsEnabled: true,
};

/** The app's own rules (training days, RPE levels, paces) come from the calculator. */
function register(profile: UserProfile, password = 'x', timeZoneId = 'UTC') {
  return toRegisterRequest(
    profile,
    password,
    password,
    timeZoneId,
    TestBed.inject(NutritionCalculator),
  );
}

function problem(status: number, detail: string | null = null, fields: string[] = []): ApiProblem {
  return { status, detail, fields };
}

describe('toRegisterRequest', () => {
  it('maps the sign-up draft to the flat RegisterRequest', () => {
    expect(register(PROFILE, 'hemmelig1234', 'Europe/Copenhagen')).toEqual({
      email: 'mads@nutrify.dk',
      username: 'mads',
      password: 'hemmelig1234',
      passwordConfirmation: 'hemmelig1234',
      birthDate: '1998-05-16',
      gender: 'Male',
      startingWeight: 75.5,
      height: 178,
      dailySteps: 6000,
      trainingDaysPerWeek: 3,
      workoutDurationMinutes: 45,
      trainingIntensity: 'Moderate',
      goalType: 'LoseWeight',
      targetWeight: 70,
      weightChangePerWeek: 0.5,
      notificationsEnabled: true,
      acceptedTerms: true,
      timeZoneId: 'Europe/Copenhagen',
    });
  });

  it('maps gender, RPE and pace through the app tables', () => {
    const map = (patch: Partial<UserProfile>) => register({ ...PROFILE, ...patch });

    expect(map({ gender: 'kvinde' }).gender).toBe('Female');
    expect(map({ gender: 'andet' }).gender).toBe('Other');
    expect(map({ gender: null }).gender).toBe('Unspecified');
    expect(map({ trainingRpe: 4 }).trainingIntensity).toBe('Low');
    expect(map({ trainingRpe: 8 }).trainingIntensity).toBe('High');
    expect(map({ goal: 'tage', pace: 'hurtig' })).toMatchObject({
      goalType: 'GainWeight',
      weightChangePerWeek: 1,
    });
    expect(map({ pace: 'rolig' }).weightChangePerWeek).toBe(0.25);
  });

  it('maps the RPE boundaries like the calculator, clamping an out-of-range RPE', () => {
    const intensity = (trainingRpe: number) =>
      register({ ...PROFILE, trainingRpe }).trainingIntensity;

    expect(intensity(5)).toBe('Moderate');
    expect(intensity(7)).toBe('Moderate');
    expect(intensity(11)).toBe('High');
    expect(intensity(0)).toBe('Low');
  });

  it('sends neither goal weight nor pace to maintain', () => {
    expect(register({ ...PROFILE, goal: 'hold', pace: null })).toMatchObject({
      goalType: 'MaintainWeight',
      targetWeight: null,
      weightChangePerWeek: null,
    });
    // A pace left over from an earlier goal is not sent either.
    expect(register({ ...PROFILE, goal: 'hold', pace: 'moderat' }).weightChangePerWeek).toBeNull();
  });

  it('falls back to the moderate intensity without training days or RPE', () => {
    const noDays = [false, false, false, false, false, false, false];

    expect(register({ ...PROFILE, trainingDays: noDays, trainingRpe: 9 })).toMatchObject({
      trainingDaysPerWeek: 0,
      trainingIntensity: 'Moderate',
    });
    expect(register({ ...PROFILE, trainingRpe: null }).trainingIntensity).toBe('Moderate');
  });
});

describe('auth error resolvers', () => {
  it('tells the two register conflicts apart by their detail', () => {
    expect(registerErrorKey(problem(409, 'That username is already in use.'))).toBe(
      'core.auth.error.usernameTaken',
    );
    expect(registerErrorKey(problem(409, 'An account with that email already exists.'))).toBe(
      'core.auth.error.emailTaken',
    );
    expect(registerErrorKey(problem(400, null, ['password']))).toBe(
      'core.auth.error.passwordTooShort',
    );
    expect(registerErrorKey(problem(400, 'Height must be between 100 and 250 cm.'))).toBe(
      'core.auth.error.registerFailed',
    );
    expect(registerErrorKey(problem(500))).toBeNull();
  });

  it('maps a login 401 and 400 to invalid credentials and a 429 to the lockout', () => {
    expect(loginErrorKey(problem(401, 'Invalid credentials.'))).toBe(
      'core.auth.error.invalidCredentials',
    );
    expect(loginErrorKey(problem(400, null, ['password']))).toBe(
      'core.auth.error.invalidCredentials',
    );
    expect(loginErrorKey(problem(429, 'Too many requests'))).toBe(
      'core.auth.error.tooManyAttempts',
    );
    // 403 (unverified) is handled by the session; the rest gets the generic text.
    expect(loginErrorKey(problem(403))).toBeNull();
    expect(loginErrorKey(problem(0))).toBeNull();
  });
});
