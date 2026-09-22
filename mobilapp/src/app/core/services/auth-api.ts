import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map, throwError, timer } from 'rxjs';
import { AUTH_ENDPOINT, AUTH_ERROR_MESSAGE, AuthEndpoint } from '../constants/auth';
import { ApiError } from '../models/api-error';
import { RegisterRequest, VerificationStatusResponse } from '../models/auth';
import { UserProfile } from '../models/profile';

/** Placeholder for the backend's response time, so the UI shows its loading state. */
const DEFAULT_DELAY_MS = 400;

/** Response time of the stubbed sign-up calls. Set to 0 in tests. */
export const AUTH_API_DELAY_MS = new InjectionToken<number>('AUTH_API_DELAY_MS', {
  providedIn: 'root',
  factory: () => DEFAULT_DELAY_MS,
});

/**
 * The client for the auth backend.
 *
 * There is no backend yet. The sign-up calls (`register`, `resendVerification`,
 * `checkVerification`) build their typed request and answer with a stubbed success, so the
 * flow can be clicked through. Once the backend exists, `stub()` is replaced by an
 * `HttpClient` call to the same endpoint with the same body – the callers don't change.
 * The remaining calls fail with an `ApiError` the user can read.
 *
 * All field validation lives in the forms, not here.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly delayMs = inject(AUTH_API_DELAY_MS);

  login(_username: string, _password: string): Observable<never> {
    return this.notImplemented();
  }

  register(profile: UserProfile, password: string): Observable<void> {
    const { photo: _photo, ...rest } = profile;
    const request: RegisterRequest = { password, profile: rest };
    return this.stub(AUTH_ENDPOINT.REGISTER, request, undefined);
  }

  requestPasswordReset(_email: string): Observable<never> {
    return this.notImplemented();
  }

  verifyResetCode(_code: string): Observable<never> {
    return this.notImplemented();
  }

  resetPassword(_password: string): Observable<never> {
    return this.notImplemented();
  }

  resendVerification(): Observable<void> {
    return this.stub(AUTH_ENDPOINT.RESEND_VERIFICATION, null, undefined);
  }

  /** The stub answers "verified", so "Tjek igen" unlocks Home. */
  checkVerification(): Observable<boolean> {
    const response: VerificationStatusResponse = { verified: true };
    return this.stub(AUTH_ENDPOINT.VERIFICATION_STATUS, null, response).pipe(
      map(({ verified }) => verified),
    );
  }

  /** Stand-in for `http.post<T>(endpoint, body)`: answers `response` after `AUTH_API_DELAY_MS`. */
  private stub<T>(
    _endpoint: AuthEndpoint,
    _body: RegisterRequest | null,
    response: T,
  ): Observable<T> {
    return timer(this.delayMs).pipe(map(() => response));
  }

  private notImplemented(): Observable<never> {
    const error: ApiError = { message: AUTH_ERROR_MESSAGE.NO_BACKEND };
    return throwError(() => error);
  }
}
