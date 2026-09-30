import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { RegisterRequest } from '../../models/auth';
import { TEST_AUTH_RESPONSE } from '../../testing/fixtures';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { AuthApi } from './auth-api';

const REGISTER_REQUEST: RegisterRequest = {
  email: 'mads@nutrify.dk',
  username: 'mads',
  password: 'hemmelig1234',
  passwordConfirmation: 'hemmelig1234',
  birthDate: '1998-05-16',
  gender: 'Male',
  startingWeight: 75,
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
};

describe('AuthApi', () => {
  let api: AuthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** Subscribes, expects exactly one request and returns it with the call's result. */
  function call<T>(request: Observable<T>, method: string, url: string) {
    const result = firstValueFrom(request);
    const pending = http.expectOne({ method, url });
    return { result, pending };
  }

  it('posts each auth call to its endpoint with the API-shaped body', async () => {
    const cases: [Observable<unknown>, string, unknown][] = [
      [api.register(REGISTER_REQUEST), 'auth/register', REGISTER_REQUEST],
      [
        api.login({ emailOrUsername: 'mads', password: 'p' }),
        'auth/login',
        { emailOrUsername: 'mads', password: 'p' },
      ],
      [api.refresh({ refreshToken: 'r' }), 'auth/refresh', { refreshToken: 'r' }],
      [api.logout({ refreshToken: 'r' }), 'auth/logout', { refreshToken: 'r' }],
      [
        api.resendVerification({ emailOrUsername: 'a@b.dk' }),
        'auth/email/resend-verification',
        { emailOrUsername: 'a@b.dk' },
      ],
      [
        api.forgotPassword({ emailOrUsername: 'mads' }),
        'auth/password/forgot',
        { emailOrUsername: 'mads' },
      ],
    ];
    for (const [request, endpoint, body] of cases) {
      const { result, pending } = call(request, 'POST', `/api/v1/${endpoint}`);
      expect(pending.request.body).toEqual(body);
      pending.flush(null, { status: 204, statusText: 'No Content' });
      await result;
    }
  });

  it('returns the API response of login', async () => {
    const { result, pending } = call(
      api.login({ emailOrUsername: 'a@b.dk', password: 'p' }),
      'POST',
      '/api/v1/auth/login',
    );
    pending.flush(TEST_AUTH_RESPONSE);

    await expect(result).resolves.toEqual(TEST_AUTH_RESPONSE);
  });

  it('deletes the account with DELETE /me', async () => {
    const { result, pending } = call(api.deleteAccount(), 'DELETE', '/api/v1/me');
    pending.flush(null, { status: 204, statusText: 'No Content' });

    await expect(result).resolves.toBeNull();
  });

  it('fails with an ApiError the user can read', async () => {
    const { result, pending } = call(
      api.login({ emailOrUsername: 'a@b.dk', password: 'p' }),
      'POST',
      '/api/v1/auth/login',
    );
    pending.flush(
      { title: 'Unauthorized', status: 401, detail: 'Invalid credentials.' },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(result).rejects.toEqual({
      messageKey: 'core.auth.error.invalidCredentials',
      status: 401,
    });
  });

  it('tells a taken username from a taken e-mail on register', async () => {
    const { result, pending } = call(
      api.register(REGISTER_REQUEST),
      'POST',
      '/api/v1/auth/register',
    );
    pending.flush(
      { title: 'Conflict', status: 409, detail: 'That username is already in use.' },
      { status: 409, statusText: 'Conflict' },
    );

    await expect(result).rejects.toEqual({
      messageKey: 'core.auth.error.usernameTaken',
      status: 409,
    });
  });
});
