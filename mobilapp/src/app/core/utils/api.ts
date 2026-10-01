import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import {
  EMPTY,
  MonoTypeOperatorFunction,
  Observable,
  catchError,
  expand,
  reduce,
  throwError,
} from 'rxjs';
import { API_BASE_URL, API_ERROR_MESSAGE_KEY } from '../constants/api';
import { CursorPage, ProblemDetails } from '../models/api';
import { ApiError } from '../models/api-error';

/** A failed API call reduced to what a resolver needs, whatever shape its body had. */
export interface ApiProblem {
  /** The HTTP status; `0` when the request never reached the server. */
  readonly status: number;
  /** `detail` of a business error (English – match it with a regex), otherwise `null`. */
  readonly detail: string | null;
  /** The keys of a validation error, lower-cased and without `$.`: `'password'`, `'birthdate'`. */
  readonly fields: readonly string[];
}

/** Picks the translation key for a specific failure, or `null` to fall back to the generic one. */
export type ApiErrorResolver = (problem: ApiProblem) => string | null;

const JSON_PATH_PREFIX = /^\$\./;
/** Starts with a scheme (`http:`, `capacitor:`, `data:` …). */
const ABSOLUTE_URL = /^[a-z][a-z\d+.-]*:/i;
/** The API sends up to seven fraction digits; `Date` only needs (and reliably parses) three. */
const EXTRA_FRACTION_DIGITS = /(\.\d{3})\d+/;

/**
 * Turns anything a service's HTTP call can fail with into an `ApiError`. It reads all three
 * error bodies of the API – a business error `{ title, status, detail }`, a validation error
 * with an `errors` map, and `NotFound()` without `detail` – as well as an empty body and
 * status 0. `resolve` maps the known cases to specific keys; the rest get the generic network,
 * server or "request failed" key. An `ApiError` passes through unchanged.
 */
export function toApiError(error: unknown, resolve?: ApiErrorResolver): ApiError {
  if (isApiError(error)) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    // Not a failed call but a bug (e.g. in a response mapping) – logged, so it isn't hidden behind
    // the generic text. HTTP bodies never get here, so no tokens or personal data are logged.
    console.error('Unexpected non-HTTP error', error);
    return { messageKey: API_ERROR_MESSAGE_KEY.REQUEST_FAILED };
  }
  const problem = toApiProblem(error);
  return {
    messageKey: resolve?.(problem) ?? genericMessageKey(problem.status),
    status: problem.status,
  };
}

/** `catchError` that rethrows every failure as an `ApiError` – the last step of a service's HTTP pipe. */
export function mapApiError<T>(resolve?: ApiErrorResolver): MonoTypeOperatorFunction<T> {
  return catchError((error: unknown) => throwError(() => toApiError(error, resolve)));
}

/**
 * Follows `nextCursor` until `hasMore` is `false` and emits every item once, in the API's order
 * (newest first). `fetchPage(null)` is the first page.
 */
export function fetchAllPages<T>(
  fetchPage: (cursor: string | null) => Observable<CursorPage<T>>,
): Observable<T[]> {
  return fetchPage(null).pipe(
    expand((page) =>
      page.hasMore && page.nextCursor !== null ? fetchPage(page.nextCursor) : EMPTY,
    ),
    reduce<CursorPage<T>, T[]>((items, page) => items.concat(page.items), []),
  );
}

/** Joins the API's base URL and a relative endpoint: `url('auth/login')` → `'/api/v1/auth/login'`. */
export function injectApiUrl(): (endpoint: string) => string {
  const baseUrl = inject(API_BASE_URL);
  return (endpoint) => `${baseUrl}/${endpoint}`;
}

/**
 * A URL the API answers relative to its own origin (Development's `/api/v1/dev-images/…`) made
 * absolute against `API_BASE_URL`. The native apps load the page from their own origin, so a
 * relative URL would point there. In the browser the base is relative too and the URL stays as it
 * is (the dev proxy serves it). Absolute and `data:` URLs are returned unchanged.
 */
export function resolveApiUrl(url: string, apiBaseUrl: string): string {
  return ABSOLUTE_URL.test(url) || !ABSOLUTE_URL.test(apiBaseUrl)
    ? url
    : new URL(url, apiBaseUrl).href;
}

/** Parses an API timestamp (UTC with `Z`, 0–7 fraction digits). */
export function parseApiDateTime(value: string): Date {
  return new Date(value.replace(EXTRA_FRACTION_DIGITS, '$1'));
}

function isApiError(error: unknown): error is ApiError {
  return isRecord(error) && typeof error['messageKey'] === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The error body as a record, or `{}` for an empty or non-JSON body. Android's CapacitorHttp hands
 * a problem body over as text, so a string is parsed as well. Unchecked JSON – every field still
 * has to be checked before it is used.
 */
export function readProblemBody(error: HttpErrorResponse): Readonly<Record<string, unknown>> {
  if (isRecord(error.error)) {
    return error.error;
  }
  if (typeof error.error === 'string') {
    try {
      const parsed: unknown = JSON.parse(error.error);
      return isRecord(parsed) ? parsed : {};
    } catch {
      // Not JSON (e.g. a proxy's HTML error page) – treated as an empty body.
      return {};
    }
  }
  return {};
}

function toApiProblem(error: HttpErrorResponse): ApiProblem {
  const body = readProblemBody(error) as ProblemDetails;
  const detail = typeof body.detail === 'string' ? body.detail : null;
  const errors = isRecord(body.errors) ? Object.keys(body.errors) : [];
  return {
    status: error.status,
    detail,
    fields: errors.map((key) => key.replace(JSON_PATH_PREFIX, '').toLowerCase()),
  };
}

function genericMessageKey(status: number): string {
  if (status === 0) {
    return API_ERROR_MESSAGE_KEY.NETWORK;
  }
  return status >= HttpStatusCode.InternalServerError
    ? API_ERROR_MESSAGE_KEY.SERVER
    : API_ERROR_MESSAGE_KEY.REQUEST_FAILED;
}
