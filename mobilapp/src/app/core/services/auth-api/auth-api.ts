import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AUTH_ENDPOINT, ME_ENDPOINT } from '../../constants/auth';
import {
  AuthResponse,
  EmailRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UserDto,
  VerifyEmailRequest,
} from '../../models/auth';
import { injectApiUrl, mapApiError } from '../../utils/api';
import { emailErrorKey, loginErrorKey, registerErrorKey, tokenErrorKey } from './auth-mapping';

/**
 * The HTTP client for the API's account lifecycle: one method per endpoint, API-shaped
 * bodies. Every call fails with an `ApiError` (`mapApiError`), so callers never see an
 * `HttpErrorResponse`. Session state lives in `SessionService`, not here; `logout` and
 * `deleteAccount` need a bearer, which the auth interceptor adds.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectApiUrl();

  /** 201 without tokens: the account can't log in until the e-mail is verified. */
  register(request: RegisterRequest): Observable<UserDto> {
    return this.http
      .post<UserDto>(this.url(AUTH_ENDPOINT.REGISTER), request)
      .pipe(mapApiError(registerErrorKey));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(this.url(AUTH_ENDPOINT.LOGIN), request)
      .pipe(mapApiError(loginErrorKey));
  }

  /** Rotates both tokens; the old refresh token is dead afterwards. */
  refresh(request: RefreshRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(this.url(AUTH_ENDPOINT.REFRESH), request)
      .pipe(mapApiError());
  }

  /** Revokes the refresh token. Needs a valid access token. */
  logout(request: RefreshRequest): Observable<void> {
    return this.http.post<void>(this.url(AUTH_ENDPOINT.LOGOUT), request).pipe(mapApiError());
  }

  verifyEmail(request: VerifyEmailRequest): Observable<void> {
    return this.http
      .post<void>(this.url(AUTH_ENDPOINT.VERIFY_EMAIL), request)
      .pipe(mapApiError(tokenErrorKey));
  }

  /** Always 204. Invalidates every earlier verification token. */
  resendVerification(request: EmailRequest): Observable<void> {
    return this.http
      .post<void>(this.url(AUTH_ENDPOINT.RESEND_VERIFICATION), request)
      .pipe(mapApiError(emailErrorKey));
  }

  /** Always 204 – also for unknown and unverified e-mails, which get no mail. */
  forgotPassword(request: EmailRequest): Observable<void> {
    return this.http
      .post<void>(this.url(AUTH_ENDPOINT.FORGOT_PASSWORD), request)
      .pipe(mapApiError(emailErrorKey));
  }

  /** Validates the token and sets the password in one call; revokes every refresh token. */
  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http
      .post<void>(this.url(AUTH_ENDPOINT.RESET_PASSWORD), request)
      .pipe(mapApiError(tokenErrorKey));
  }

  /** Irreversibly anonymises the account and all its data. */
  deleteAccount(): Observable<void> {
    return this.http.delete<void>(this.url(ME_ENDPOINT)).pipe(mapApiError());
  }
}
