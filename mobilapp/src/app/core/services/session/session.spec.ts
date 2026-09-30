import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { EMPTY, firstValueFrom } from 'rxjs';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { STORAGE_KEY } from '../../constants/storage-key';
import { AuthResponse } from '../../models/auth';
import { UserProfile } from '../../models/profile';
import { SessionState } from '../../models/session';
import { FakeStorage, createFakeDocument, createFakeStorage } from '../../testing/fake-document';
import {
  AUTHENTICATED_SESSION,
  PENDING_SESSION,
  SIGNED_OUT_SESSION,
  TEST_AUTH_RESPONSE,
  TEST_EMAIL,
} from '../../testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../testing/test-providers';
import {
  SESSION_DATA_STORES,
  SessionDataService,
  SessionDataStore,
} from '../session-data/session-data';
import { UserProfileService } from '../user-profile/user-profile';
import { SessionService } from './session';

const PASSWORD = 'hemmelig1234';
const TOKEN = 'AB12'.repeat(16);
const REFRESH = '/api/v1/auth/refresh';
const LOGOUT = '/api/v1/auth/logout';
const NO_CONTENT = { status: 204, statusText: 'No Content' };
const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };
const INVALID_CREDENTIALS = {
  title: 'Unauthorized',
  status: 401,
  detail: 'Invalid email or password.',
};

const SIGNUP_PROFILE: UserProfile = {
  ...DEFAULT_PROFILE,
  username: 'mads',
  email: TEST_EMAIL,
  birthday: '1998-05-16',
  gender: 'mand',
  goal: 'hold',
};

/** A token that expires 30 s after `TEST_NOW` – inside the refresh margin. */
const EXPIRING_SESSION: SessionState = {
  ...AUTHENTICATED_SESSION,
  tokens: {
    ...AUTHENTICATED_SESSION.tokens!,
    accessToken: 'expiring-access-token',
    accessTokenExpiresAt: new Date(TEST_NOW.getTime() + 30_000).toISOString(),
  },
};

const ROTATED: AuthResponse = {
  ...TEST_AUTH_RESPONSE,
  accessToken: 'rotated-access-token',
  refreshToken: 'rotated-refresh-token',
};

/** Another account than the one in the fixtures. */
const OTHER_ACCOUNT: AuthResponse = {
  ...TEST_AUTH_RESPONSE,
  user: { ...TEST_AUTH_RESPONSE.user, userId: 2, email: 'sara@nutrify.dk', username: 'sara' },
};

describe('SessionService', () => {
  let storage: FakeStorage;
  let replace: ReturnType<typeof vi.fn<(url: string) => void>>;

  function setup(stored?: unknown, providers: Provider[] = []) {
    if (stored !== undefined) {
      storage.setItem(STORAGE_KEY.SESSION, JSON.stringify(stored));
    }
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment({ storage }),
        provideRouter([]),
        // The real interceptor, so the bearer and the refresh before a call are covered too.
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: DOCUMENT,
          useValue: {
            ...createFakeDocument(storage),
            baseURI: 'https://localhost/',
            location: { replace },
          },
        },
        ...providers,
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return {
      session: TestBed.inject(SessionService),
      http: TestBed.inject(HttpTestingController),
      navigate,
    };
  }

  function stored(): SessionState | null {
    return JSON.parse(storage.getItem(STORAGE_KEY.SESSION) ?? 'null') as SessionState | null;
  }

  function seed(key: string, value: unknown): void {
    storage.setItem(key, JSON.stringify(value));
  }

  beforeEach(() => {
    storage = createFakeStorage();
    replace = vi.fn<(url: string) => void>();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  describe('restore', () => {
    it('starts as a guest', () => {
      const { session } = setup();

      expect(session.status()).toBe('guest');
      expect(session.isLoggedIn()).toBe(false);
      expect(session.isAuthenticated()).toBe(false);
    });

    it('treats the old { isLoggedIn, isEmailVerified } shape as a guest', () => {
      const { session } = setup({ isLoggedIn: true, isEmailVerified: true });

      expect(session.status()).toBe('guest');
    });

    it('restores an authenticated session', () => {
      const { session } = setup(AUTHENTICATED_SESSION);

      expect(session.isAuthenticated()).toBe(true);
    });

    it('restores a pending session', () => {
      const { session } = setup(PENDING_SESSION);

      expect(session.status()).toBe('pending-verification');
      expect(session.isLoggedIn()).toBe(true);
      expect(session.isAuthenticated()).toBe(false);
      expect(session.email()).toBe(TEST_EMAIL);
    });

    it('drops a session whose refresh token has expired, but keeps the e-mail', () => {
      const { session } = setup({
        ...AUTHENTICATED_SESSION,
        tokens: { ...AUTHENTICATED_SESSION.tokens!, refreshTokenExpiresAt: '2026-09-01T00:00:00Z' },
      });

      expect(session.status()).toBe('guest');
      expect(session.email()).toBe(TEST_EMAIL);
    });

    it.each([
      { status: 'authenticated', email: TEST_EMAIL, userId: 1, tokens: null },
      { status: 'authenticated', email: TEST_EMAIL, userId: 1, tokens: { accessToken: 'a' } },
      { status: 'authenticated', email: TEST_EMAIL, tokens: AUTHENTICATED_SESSION.tokens },
      { status: 'authenticated', email: null, userId: 1, tokens: AUTHENTICATED_SESSION.tokens },
      { status: 'pending-verification', email: null },
    ])('treats a malformed stored session %j as a guest', (malformed) => {
      const { session } = setup(malformed);

      expect(session.status()).toBe('guest');
    });
  });

  describe('sign-up and verification', () => {
    /** Registers `SIGNUP_PROFILE`, so the sign-up password is in memory. */
    async function register(http: HttpTestingController, session: SessionService) {
      const done = firstValueFrom(session.register(SIGNUP_PROFILE, PASSWORD, PASSWORD));
      http.expectOne('/api/v1/auth/register').flush(TEST_AUTH_RESPONSE.user);
      await done;
    }

    it('registers and waits for verification without resending the e-mail', async () => {
      const { session, http } = setup();

      const done = firstValueFrom(session.register(SIGNUP_PROFILE, PASSWORD, PASSWORD));
      const request = http.expectOne({ method: 'POST', url: '/api/v1/auth/register' });
      expect(request.request.body).toMatchObject({
        email: TEST_EMAIL,
        username: 'mads',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
        goalType: 'MaintainWeight',
        acceptedTerms: true,
      });
      request.flush({ ...TEST_AUTH_RESPONSE.user, isActive: false, emailVerifiedAt: null });
      await done;

      // `verify()` in afterEach proves there was no resend call.
      expect(session.status()).toBe('pending-verification');
      expect(stored()).toEqual(PENDING_SESSION);
      expect(storage.getItem(STORAGE_KEY.SESSION)).not.toContain(PASSWORD);
    });

    it('verifies the pasted token and logs in with the sign-up password', async () => {
      const { session, http } = setup();
      await register(http, session);

      const done = firstValueFrom(session.verifyEmail(` ${TOKEN.toLowerCase()} `));
      const verify = http.expectOne({ method: 'POST', url: '/api/v1/auth/email/verify' });
      expect(verify.request.body).toEqual({ token: TOKEN });
      verify.flush(null, NO_CONTENT);
      const login = http.expectOne({ method: 'POST', url: '/api/v1/auth/login' });
      expect(login.request.body).toEqual({ email: TEST_EMAIL, password: PASSWORD });
      login.flush(TEST_AUTH_RESPONSE);
      await done;

      expect(session.isAuthenticated()).toBe(true);
      expect(stored()).toEqual(AUTHENTICATED_SESSION);
    });

    it('only logs in again when the login after a successful verify failed', async () => {
      const { session, http } = setup();
      await register(http, session);

      const first = firstValueFrom(session.verifyEmail(TOKEN));
      http.expectOne('/api/v1/auth/email/verify').flush(null, NO_CONTENT);
      http.expectOne('/api/v1/auth/login').error(new ProgressEvent('error'));
      await expect(first).rejects.toMatchObject({ messageKey: 'common.error.network' });
      expect(session.status()).toBe('pending-verification');

      // The token is used up now – sending it again would say "invalid code".
      const second = firstValueFrom(session.verifyEmail(TOKEN));
      http.expectOne('/api/v1/auth/login').flush(TEST_AUTH_RESPONSE);
      await second;

      expect(session.isAuthenticated()).toBe(true);
    });

    it('sends the user to login after verifying when the password is no longer known', async () => {
      const { session, http, navigate } = setup(PENDING_SESSION);

      const done = firstValueFrom(session.verifyEmail(TOKEN));
      http.expectOne('/api/v1/auth/email/verify').flush(null, NO_CONTENT);
      await done;

      expect(session.status()).toBe('guest');
      expect(session.email()).toBe(TEST_EMAIL);
      expect(navigate).toHaveBeenCalledWith('/login');
    });

    it('checks the verification by trying to log in: 401 means not yet', async () => {
      const { session, http } = setup();
      await register(http, session);

      const first = firstValueFrom(session.checkVerification());
      http.expectOne('/api/v1/auth/login').flush(INVALID_CREDENTIALS, UNAUTHORIZED);
      await expect(first).resolves.toBe(false);
      expect(session.status()).toBe('pending-verification');

      const second = firstValueFrom(session.checkVerification());
      http.expectOne('/api/v1/auth/login').flush(TEST_AUTH_RESPONSE);
      await expect(second).resolves.toBe(true);
      expect(session.isAuthenticated()).toBe(true);
    });

    it('explains that it cannot check without the sign-up password instead of saying "no"', async () => {
      const { session } = setup(PENDING_SESSION);

      await expect(firstValueFrom(session.checkVerification())).rejects.toEqual({
        messageKey: 'core.auth.error.verificationUncheckable',
      });
      expect(session.status()).toBe('pending-verification');
    });

    it('resends the verification e-mail to the pending address', async () => {
      const { session, http } = setup(PENDING_SESSION);

      const done = firstValueFrom(session.resendVerification());
      const request = http.expectOne('/api/v1/auth/email/resend-verification');
      expect(request.request.body).toEqual({ email: TEST_EMAIL });
      request.flush(null, NO_CONTENT);
      await done;
    });
  });

  describe('login', () => {
    it('authenticates and names an empty profile after the account', async () => {
      const { session, http } = setup();

      const done = firstValueFrom(session.login(` ${TEST_EMAIL} `, PASSWORD));
      http.expectOne('/api/v1/auth/login').flush(TEST_AUTH_RESPONSE);
      await done;

      expect(session.isAuthenticated()).toBe(true);
      expect(TestBed.inject(UserProfileService).profile()).toMatchObject({
        username: 'mads',
        email: TEST_EMAIL,
      });
    });

    it('stays a guest when the credentials are wrong', async () => {
      const { session, http } = setup();

      const done = firstValueFrom(session.login(TEST_EMAIL, 'forkert'));
      http.expectOne('/api/v1/auth/login').flush(INVALID_CREDENTIALS, UNAUTHORIZED);

      await expect(done).rejects.toEqual({
        messageKey: 'core.auth.error.invalidCredentials',
        status: 401,
      });
      expect(session.status()).toBe('guest');
    });
  });

  describe('accounts on a shared device', () => {
    const LOCAL_PROFILE: UserProfile = {
      ...DEFAULT_PROFILE,
      username: 'mads',
      email: TEST_EMAIL,
      weightKg: 90,
    };

    beforeEach(() => {
      seed(STORAGE_KEY.FOOD_LOG, { '2026-09-21': [] });
      seed(STORAGE_KEY.THEME, 'dark');
      seed(STORAGE_KEY.LANGUAGE, 'en');
    });

    it("clears the previous account's local data when another one logs in", async () => {
      const { session, http } = setup(SIGNED_OUT_SESSION);
      TestBed.inject(UserProfileService).replace(LOCAL_PROFILE);

      const done = firstValueFrom(session.login('sara@nutrify.dk', PASSWORD));
      http.expectOne('/api/v1/auth/login').flush(OTHER_ACCOUNT);
      await done;

      expect(TestBed.inject(UserProfileService).profile()).toEqual({
        ...DEFAULT_PROFILE,
        username: 'sara',
        email: 'sara@nutrify.dk',
      });
      expect(storage.getItem(STORAGE_KEY.FOOD_LOG)).toBeNull();
      // Device settings stay.
      expect(storage.getItem(STORAGE_KEY.THEME)).toBe('"dark"');
      expect(storage.getItem(STORAGE_KEY.LANGUAGE)).toBe('"en"');
      expect(stored()?.userId).toBe(2);
    });

    it('keeps the local data when the same account logs in again', async () => {
      const { session, http } = setup(SIGNED_OUT_SESSION);
      TestBed.inject(UserProfileService).replace(LOCAL_PROFILE);

      const done = firstValueFrom(session.login(TEST_EMAIL, PASSWORD));
      http.expectOne('/api/v1/auth/login').flush(TEST_AUTH_RESPONSE);
      await done;

      expect(TestBed.inject(UserProfileService).profile()).toEqual(LOCAL_PROFILE);
      expect(storage.getItem(STORAGE_KEY.FOOD_LOG)).not.toBeNull();
    });

    it("clears the previous account's local data before a new account is created", async () => {
      const { session, http } = setup(SIGNED_OUT_SESSION);
      TestBed.inject(UserProfileService).replace(LOCAL_PROFILE);

      const done = firstValueFrom(session.register(SIGNUP_PROFILE, PASSWORD, PASSWORD));
      http.expectOne('/api/v1/auth/register').flush(OTHER_ACCOUNT.user);
      await done;

      expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(DEFAULT_PROFILE.weightKg);
      expect(storage.getItem(STORAGE_KEY.FOOD_LOG)).toBeNull();
      expect(storage.getItem(STORAGE_KEY.THEME)).toBe('"dark"');
      expect(stored()).toMatchObject({ status: 'pending-verification', userId: 2 });
    });
  });

  describe('logout', () => {
    it('revokes the refresh token with the bearer and becomes a guest', async () => {
      const { session, http } = setup(AUTHENTICATED_SESSION);
      TestBed.inject(UserProfileService).update({ username: 'mads' });

      const done = firstValueFrom(session.logout());
      const request = http.expectOne({ method: 'POST', url: LOGOUT });
      expect(request.request.headers.get('Authorization')).toBe('Bearer test-access-token');
      expect(request.request.body).toEqual({ refreshToken: 'test-refresh-token' });
      request.flush(null, NO_CONTENT);
      await done;

      expect(session.status()).toBe('guest');
      expect(stored()).toEqual(SIGNED_OUT_SESSION);
      expect(TestBed.inject(UserProfileService).profile().username).toBe('mads');
    });

    it('ends the session even when the API fails (best effort)', async () => {
      const { session, http } = setup(AUTHENTICATED_SESSION);

      const done = firstValueFrom(session.logout());
      http.expectOne(LOGOUT).error(new ProgressEvent('error'));
      await done;

      expect(session.status()).toBe('guest');
    });

    it('refreshes an expiring token first and revokes the new refresh token', async () => {
      const { session, http } = setup(EXPIRING_SESSION);

      const done = firstValueFrom(session.logout());
      http.expectOne(REFRESH).flush(ROTATED);
      const request = http.expectOne(LOGOUT);
      expect(request.request.headers.get('Authorization')).toBe('Bearer rotated-access-token');
      expect(request.request.body).toEqual({ refreshToken: 'rotated-refresh-token' });
      request.flush(null, NO_CONTENT);
      await done;

      expect(session.status()).toBe('guest');
    });

    it('refreshes once and revokes the new refresh token when the API rejects the bearer', async () => {
      const { session, http } = setup(AUTHENTICATED_SESSION);

      const done = firstValueFrom(session.logout());
      http.expectOne(LOGOUT).flush(null, UNAUTHORIZED);
      http.expectOne(REFRESH).flush(ROTATED);
      // The interceptor doesn't retry the old body – this is the session's own resend.
      const request = http.expectOne(LOGOUT);
      expect(request.request.body).toEqual({ refreshToken: 'rotated-refresh-token' });
      expect(request.request.headers.get('Authorization')).toBe('Bearer rotated-access-token');
      request.flush(null, NO_CONTENT);
      await done;

      expect(session.status()).toBe('guest');
    });

    it('waits for a refresh in flight and revokes the refresh token it rotated to', async () => {
      const { session, http } = setup(AUTHENTICATED_SESSION);
      session.refresh().subscribe();

      const done = firstValueFrom(session.logout());
      expect(http.match(LOGOUT)).toHaveLength(0);
      http.expectOne(REFRESH).flush(ROTATED);
      const request = http.expectOne(LOGOUT);
      expect(request.request.body).toEqual({ refreshToken: 'rotated-refresh-token' });
      request.flush(null, NO_CONTENT);
      await done;

      expect(session.status()).toBe('guest');
    });

    it('does not bring the session back when a refresh answers after the log out', async () => {
      const { session, http } = setup(AUTHENTICATED_SESSION);

      const done = firstValueFrom(session.logout());
      const late = firstValueFrom(session.refresh());
      http.expectOne(LOGOUT).flush(null, NO_CONTENT);
      await done;
      http.expectOne(REFRESH).flush(ROTATED);
      await late;

      expect(session.status()).toBe('guest');
      expect(stored()).toEqual(SIGNED_OUT_SESSION);
    });

    it('needs no API call while the e-mail is unverified', async () => {
      const { session } = setup(PENDING_SESSION);

      await firstValueFrom(session.logout());

      expect(session.status()).toBe('guest');
    });
  });

  describe('deleteAccount', () => {
    it('clears every app key and reloads at login only after the API has deleted it', async () => {
      for (const key of Object.values(STORAGE_KEY)) {
        seed(key, 'x');
      }
      // A store that (against the contract) writes when it is reset must not bring a key back.
      const store: SessionDataStore = {
        load: () => EMPTY,
        reset: () => seed(STORAGE_KEY.FOOD_LOG, []),
      };
      const { session, http } = setup(AUTHENTICATED_SESSION, [
        { provide: SESSION_DATA_STORES, useValue: [store] },
      ]);
      TestBed.inject(SessionDataService);
      TestBed.tick();

      const done = firstValueFrom(session.deleteAccount());
      const request = http.expectOne({ method: 'DELETE', url: '/api/v1/me' });
      expect(request.request.headers.get('Authorization')).toBe('Bearer test-access-token');
      expect(replace).not.toHaveBeenCalled();
      request.flush(null, NO_CONTENT);
      await done;
      TestBed.tick();

      expect(storage.data.size).toBe(0);
      expect(replace).toHaveBeenCalledWith('https://localhost/login');
    });

    it('deletes nothing locally when the API fails', async () => {
      const { session, http } = setup(AUTHENTICATED_SESSION);

      const done = firstValueFrom(session.deleteAccount());
      http
        .expectOne('/api/v1/me')
        .flush({ title: 'Unexpected server error', status: 500 }, { status: 500, statusText: 'x' });

      await expect(done).rejects.toEqual({ messageKey: 'common.error.server', status: 500 });
      expect(session.isAuthenticated()).toBe(true);
      expect(stored()).toEqual(AUTHENTICATED_SESSION);
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe('tokens', () => {
    it('hands out a valid access token without refreshing', async () => {
      const { session } = setup(AUTHENTICATED_SESSION);

      await expect(firstValueFrom(session.accessToken())).resolves.toBe('test-access-token');
    });

    it('has no access token as a guest', async () => {
      const { session } = setup();

      await expect(firstValueFrom(session.accessToken())).resolves.toBeNull();
    });

    it('refreshes once for concurrent callers and stores the rotated tokens', async () => {
      const { session, http } = setup(EXPIRING_SESSION);

      const first = firstValueFrom(session.accessToken());
      const second = firstValueFrom(session.refresh());
      const request = http.expectOne({ method: 'POST', url: REFRESH });
      expect(request.request.body).toEqual({ refreshToken: 'test-refresh-token' });
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush(ROTATED);

      await expect(first).resolves.toBe('rotated-access-token');
      await expect(second).resolves.toBe('rotated-access-token');
      expect(stored()?.tokens?.refreshToken).toBe('rotated-refresh-token');
    });

    it('starts a new refresh with the rotated token once the previous one has finished', async () => {
      const { session, http } = setup(EXPIRING_SESSION);

      const first = firstValueFrom(session.refresh());
      // Rotated, but (for the test) expiring just as soon – so the next call refreshes again.
      http.expectOne(REFRESH).flush({
        ...ROTATED,
        accessTokenExpiresAt: EXPIRING_SESSION.tokens!.accessTokenExpiresAt,
      });
      await first;

      const second = firstValueFrom(session.accessToken());
      const request = http.expectOne(REFRESH);
      expect(request.request.body).toEqual({ refreshToken: 'rotated-refresh-token' });
      request.flush({
        ...ROTATED,
        accessToken: 'second-access-token',
        refreshToken: 'second-refresh-token',
      });

      await expect(second).resolves.toBe('second-access-token');
    });

    it('starts a new refresh after one failed for lack of network', async () => {
      const { session, http } = setup(EXPIRING_SESSION);

      const first = firstValueFrom(session.refresh());
      http.expectOne(REFRESH).error(new ProgressEvent('error'));
      await expect(first).rejects.toMatchObject({ status: 0 });

      const second = firstValueFrom(session.refresh());
      http.expectOne(REFRESH).flush(ROTATED);

      await expect(second).resolves.toBe('rotated-access-token');
    });

    it('keeps the rotated tokens when every caller unsubscribes mid-refresh', () => {
      const { session, http } = setup(EXPIRING_SESSION);

      session.refresh().subscribe().unsubscribe();
      http.expectOne(REFRESH).flush(ROTATED);

      expect(stored()?.tokens?.refreshToken).toBe('rotated-refresh-token');
    });

    it('ends the session and goes to login when the refresh token is rejected', async () => {
      const { session, http, navigate } = setup(EXPIRING_SESSION);

      const done = firstValueFrom(session.refresh());
      http
        .expectOne(REFRESH)
        .flush(
          { title: 'Unauthorized', status: 401, detail: 'The refresh token is no longer active.' },
          UNAUTHORIZED,
        );

      await expect(done).rejects.toMatchObject({ status: 401 });
      expect(session.status()).toBe('guest');
      expect(navigate).toHaveBeenCalledWith('/login');
    });

    it('keeps the session when the refresh fails for lack of network', async () => {
      const { session, http, navigate } = setup(EXPIRING_SESSION);

      const done = firstValueFrom(session.refresh());
      http.expectOne(REFRESH).error(new ProgressEvent('error'));

      await expect(done).rejects.toMatchObject({ status: 0 });
      expect(session.isAuthenticated()).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
