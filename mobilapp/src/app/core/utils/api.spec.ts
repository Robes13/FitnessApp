import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of } from 'rxjs';
import { CursorPage } from '../models/api';
import { ApiProblem, fetchAllPages, injectApiUrl, parseApiDateTime, toApiError } from './api';

const REQUEST_FAILED = 'common.error.requestFailed';

function httpError(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('toApiError', () => {
  it('reads a business error body and hands it to the resolver', () => {
    const resolve = vi.fn((problem: ApiProblem) => (problem.status === 409 ? 'taken' : null));

    const error = toApiError(
      httpError(409, {
        title: 'Conflict',
        status: 409,
        detail: 'That username is already in use.',
      }),
      resolve,
    );

    expect(error).toEqual({ messageKey: 'taken', status: 409 });
    expect(resolve).toHaveBeenCalledWith({
      status: 409,
      detail: 'That username is already in use.',
      fields: [],
    });
  });

  it('reads the fields of a validation error, lower-cased and without "$."', () => {
    const resolve = vi.fn(() => null);

    toApiError(
      httpError(400, {
        type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { Password: ['too short'], '$.gender': ['bad'] },
      }),
      resolve,
    );

    expect(resolve).toHaveBeenCalledWith({
      status: 400,
      detail: null,
      fields: ['password', 'gender'],
    });
  });

  it('reads NotFound() without a detail and an empty body', () => {
    const resolve = vi.fn(() => null);

    toApiError(httpError(404, { title: 'Not Found', status: 404, traceId: 'x' }), resolve);
    toApiError(httpError(401, null), resolve);

    expect(resolve).toHaveBeenNthCalledWith(1, { status: 404, detail: null, fields: [] });
    expect(resolve).toHaveBeenNthCalledWith(2, { status: 401, detail: null, fields: [] });
  });

  it('falls back to the generic network, server and request-failed keys', () => {
    expect(toApiError(httpError(0, new ProgressEvent('error')))).toEqual({
      messageKey: 'common.error.network',
      status: 0,
    });
    expect(toApiError(httpError(500, { detail: 'An unexpected error occurred.' }))).toEqual({
      messageKey: 'common.error.server',
      status: 500,
    });
    expect(toApiError(httpError(400, 'not json'), () => null)).toEqual({
      messageKey: REQUEST_FAILED,
      status: 400,
    });
  });

  it('passes an ApiError through and never exposes – but logs – a non-HTTP error', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const apiError = { messageKey: 'core.auth.error.invalidCode', status: 400 };
    const bug = new TypeError('boom');

    expect(toApiError(apiError, () => 'other')).toBe(apiError);
    expect(logged).not.toHaveBeenCalled();
    expect(toApiError(bug)).toEqual({ messageKey: REQUEST_FAILED });
    expect(logged).toHaveBeenCalledWith('Unexpected non-HTTP error', bug);
    logged.mockRestore();
  });
});

describe('fetchAllPages', () => {
  const pages: Record<string, CursorPage<number>> = {
    first: { items: [5, 4], nextCursor: 'b', hasMore: true },
    b: { items: [3, 2], nextCursor: 'c', hasMore: true },
    c: { items: [1], nextCursor: null, hasMore: false },
  };

  it('follows nextCursor until hasMore is false and keeps the API order', async () => {
    const cursors: (string | null)[] = [];
    const fetchPage = (cursor: string | null): Observable<CursorPage<number>> => {
      cursors.push(cursor);
      return of(pages[cursor ?? 'first']!);
    };

    await expect(firstValueFrom(fetchAllPages(fetchPage))).resolves.toEqual([5, 4, 3, 2, 1]);
    expect(cursors).toEqual([null, 'b', 'c']);
  });

  it('emits an empty list for an empty first page', async () => {
    const empty: CursorPage<number> = { items: [], nextCursor: null, hasMore: false };

    await expect(firstValueFrom(fetchAllPages(() => of(empty)))).resolves.toEqual([]);
  });
});

describe('parseApiDateTime', () => {
  it('parses 0 to 7 fraction digits', () => {
    expect(parseApiDateTime('2026-09-30T06:27:38Z').toISOString()).toBe('2026-09-30T06:27:38.000Z');
    expect(parseApiDateTime('2026-09-30T06:27:38.4847627Z').toISOString()).toBe(
      '2026-09-30T06:27:38.484Z',
    );
  });
});

describe('injectApiUrl', () => {
  it('joins the base URL and a relative endpoint', () => {
    const url = TestBed.runInInjectionContext(() => injectApiUrl());

    expect(url('me/weight-logs')).toBe('/api/v1/me/weight-logs');
  });
});
