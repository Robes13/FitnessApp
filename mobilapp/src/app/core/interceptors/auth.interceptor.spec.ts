import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { STORAGE_KEY } from '../constants/storage-key';
import { AuthResponse } from '../models/auth';
import { SessionState } from '../models/session';
import { SessionService } from '../services/session/session';
import { createFakeStorage } from '../testing/fake-document';
import { AUTHENTICATED_SESSION, PENDING_SESSION, TEST_AUTH_RESPONSE } from '../testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../testing/test-providers';
import { authInterceptor } from './auth.interceptor';

const ME = '/api/v1/me';
const REFRESH = '/api/v1/auth/refresh';
const LOGOUT = '/api/v1/auth/logout';
const OPEN_FOOD_FACTS = 'https://world.openfoodfacts.org/api/v2/product/5701234567890.json';
const EMPTY_401 = { status: 401, statusText: 'Unauthorized' };
const ROTATED: AuthResponse = { ...TEST_AUTH_RESPONSE, accessToken: 'rotated-access-token' };

describe('authInterceptor', () => {
  function setup(session: SessionState | null = AUTHENTICATED_SESSION) {
    const storage = createFakeStorage(session === null ? {} : { [STORAGE_KEY.SESSION]: session });
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment({ storage }),
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return {
      client: TestBed.inject(HttpClient),
      http: TestBed.inject(HttpTestingController),
      session: TestBed.inject(SessionService),
      navigate,
    };
  }

  function bearerOf(http: HttpTestingController, url: string): string | null {
    return http.expectOne(url).request.headers.get('Authorization');
  }

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('adds the bearer to our API only – never to Open Food Facts', () => {
    const { client, http } = setup();

    client.get(ME).subscribe();
    client.get(OPEN_FOOD_FACTS).subscribe();

    expect(bearerOf(http, ME)).toBe('Bearer test-access-token');
    expect(bearerOf(http, OPEN_FOOD_FACTS)).toBeNull();
  });

  it('adds no bearer to the anonymous auth endpoints', () => {
    const { client, http } = setup();

    client.post('/api/v1/auth/login', {}).subscribe();

    expect(bearerOf(http, '/api/v1/auth/login')).toBeNull();
  });

  it('adds no bearer without a session', () => {
    const { client, http } = setup(null);

    client.get(ME).subscribe();

    expect(bearerOf(http, ME)).toBeNull();
  });

  it('passes an empty 401 on untouched when there is no token', async () => {
    const { client, http } = setup(PENDING_SESSION);

    const response = firstValueFrom(client.get(ME));
    http.expectOne(ME).flush(null, EMPTY_401);

    // `verify()` in afterEach proves there was no refresh.
    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('refreshes before the request when the token is about to expire', async () => {
    const { client, http } = setup({
      ...AUTHENTICATED_SESSION,
      tokens: {
        ...AUTHENTICATED_SESSION.tokens!,
        accessTokenExpiresAt: new Date(TEST_NOW.getTime() + 10_000).toISOString(),
      },
    });

    const response = firstValueFrom(client.get(ME));
    http.expectOne(REFRESH).flush(ROTATED);
    const request = http.expectOne(ME);
    expect(request.request.headers.get('Authorization')).toBe('Bearer rotated-access-token');
    request.flush({ ok: true });

    await expect(response).resolves.toEqual({ ok: true });
  });

  it('refreshes once for two concurrent empty 401s and retries both', async () => {
    const { client, http } = setup();

    const first = firstValueFrom(client.get(ME));
    const second = firstValueFrom(client.get(`${ME}/settings`));
    http.expectOne(ME).flush(null, EMPTY_401);
    http.expectOne(`${ME}/settings`).flush(null, EMPTY_401);

    http.expectOne(REFRESH).flush(ROTATED);
    const retries = [http.expectOne(ME), http.expectOne(`${ME}/settings`)];
    expect(retries.map((retry) => retry.request.headers.get('Authorization'))).toEqual([
      'Bearer rotated-access-token',
      'Bearer rotated-access-token',
    ]);
    retries[0]!.flush('me');
    retries[1]!.flush('settings');

    await expect(first).resolves.toBe('me');
    await expect(second).resolves.toBe('settings');
  });

  it('retries a 401 that lands after the refresh with the new token instead of refreshing again', async () => {
    const { client, http } = setup();

    const first = firstValueFrom(client.get(ME));
    const late = firstValueFrom(client.get(`${ME}/settings`));
    http.expectOne(ME).flush(null, EMPTY_401);
    http.expectOne(REFRESH).flush(ROTATED);
    http.expectOne(ME).flush('me');
    await first;

    // Sent with the old token, answered only now – after the refresh has finished.
    http.expectOne(`${ME}/settings`).flush(null, EMPTY_401);
    const retry = http.expectOne(`${ME}/settings`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer rotated-access-token');
    retry.flush('settings');

    await expect(late).resolves.toBe('settings');
  });

  it('retries only once', async () => {
    const { client, http, session, navigate } = setup();

    const response = firstValueFrom(client.get(ME));
    http.expectOne(ME).flush(null, EMPTY_401);
    http.expectOne(REFRESH).flush(ROTATED);
    http.expectOne(ME).flush(null, EMPTY_401);

    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(session.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('never retries logout itself – its body holds the refresh token from before the refresh', async () => {
    const { client, http } = setup();

    const response = firstValueFrom(client.post(LOGOUT, { refreshToken: 'test-refresh-token' }));
    http.expectOne(LOGOUT).flush(null, EMPTY_401);

    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('passes a 401 with a body on as a business error', async () => {
    const { client, http, session } = setup();

    const response = firstValueFrom(client.post('/api/v1/auth/password/change', {}));
    http
      .expectOne('/api/v1/auth/password/change')
      .flush(
        { title: 'Unauthorized', status: 401, detail: 'Current password is invalid.' },
        EMPTY_401,
      );

    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(session.isAuthenticated()).toBe(true);
  });

  it('signs out and goes to login when the refresh is rejected', async () => {
    const { client, http, session, navigate } = setup();

    const response = firstValueFrom(client.get(ME));
    http.expectOne(ME).flush(null, EMPTY_401);
    http
      .expectOne(REFRESH)
      .flush(
        { title: 'Unauthorized', status: 401, detail: 'The refresh token is invalid.' },
        EMPTY_401,
      );

    await expect(response).rejects.toMatchObject({ status: 401 });
    expect(session.status()).toBe('guest');
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
