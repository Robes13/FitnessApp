import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../constants/api';
import { ANONYMOUS_AUTH_ENDPOINTS, AUTH_ENDPOINT } from '../constants/auth';
import { SessionService } from '../services/session/session';

const ANONYMOUS_ENDPOINTS: ReadonlySet<string> = new Set(ANONYMOUS_AUTH_ENDPOINTS);
/**
 * Never retried here after a refresh: the body holds the refresh token as it was *before* the
 * refresh, so a retry would revoke the used token and leave the new one active.
 * `SessionService.logout()` refreshes and resends it itself.
 */
const NO_RETRY_ENDPOINTS: ReadonlySet<string> = new Set([AUTH_ENDPOINT.LOGOUT]);
const QUERY_START = '?';

/**
 * Adds `Authorization: Bearer …` to calls to our API – never to other hosts such as Open Food
 * Facts, and never to the anonymous auth endpoints. The token is refreshed shortly before it
 * expires (`SessionService.accessToken()`); an **empty** 401 means the API rejected the token,
 * so the request is retried once with a fresh token: the current one if another request has
 * already refreshed since this one was sent, otherwise after one (single-flight) refresh. A 401
 * **with** a body is a business error (e.g. wrong password) and is passed on untouched. When the
 * refresh itself is rejected, `SessionService` ends the session and sends the user to login.
 *
 * Calls to `auth/refresh` skip this interceptor, so refreshing never recurses.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const endpoint = apiEndpoint(request.url, inject(API_BASE_URL));
  if (endpoint === null || ANONYMOUS_ENDPOINTS.has(endpoint)) {
    return next(request);
  }
  const session = inject(SessionService);
  const retries = !NO_RETRY_ENDPOINTS.has(endpoint);
  return session.accessToken().pipe(
    switchMap((token) =>
      next(withBearer(request, token)).pipe(
        catchError((error: unknown) =>
          retries && token !== null && isRejectedToken(error)
            ? session.accessToken().pipe(
                switchMap((current) =>
                  current !== null && current !== token ? of(current) : session.refresh(),
                ),
                switchMap((fresh) => next(withBearer(request, fresh))),
              )
            : throwError(() => error),
        ),
      ),
    ),
  );
};

/** The endpoint relative to `API_BASE_URL` (`'me/settings'`), or `null` for another host. */
function apiEndpoint(url: string, baseUrl: string): string | null {
  const prefix = `${baseUrl}/`;
  return url.startsWith(prefix) ? (url.slice(prefix.length).split(QUERY_START)[0] ?? '') : null;
}

function withBearer(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token === null
    ? request
    : request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/** The JWT middleware answers a missing, expired or revoked token with an empty 401. */
function isRejectedToken(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === HttpStatusCode.Unauthorized &&
    (error.error === null || error.error === '')
  );
}
