import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AUTH_ENDPOINT,
  DATA_EXPORT_TOKEN_ENDPOINT,
  ME_ENDPOINT,
  WITHDRAW_TERMS_CONSENT_ENDPOINT,
} from '../../constants/auth';
import {
  AuthResponse,
  IdentifierRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  UserDto,
} from '../../models/auth';
import { injectApiUrl, mapApiError } from '../../utils/api';
import { loginErrorKey, registerErrorKey } from './auth-mapping';

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

  /** 403 without tokens while the e-mail is unverified; 429 once the account is locked out. */
  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(this.url(AUTH_ENDPOINT.LOGIN), request)
      .pipe(mapApiError(loginErrorKey));
  }

  /** A new access token; the refresh token is rotated only if it wasn't issued today (UTC). */
  refresh(request: RefreshRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(this.url(AUTH_ENDPOINT.REFRESH), request)
      .pipe(mapApiError());
  }

  /** Revokes the refresh token. Needs a valid access token. */
  logout(request: RefreshRequest): Observable<void> {
    return this.http.post<void>(this.url(AUTH_ENDPOINT.LOGOUT), request).pipe(mapApiError());
  }

  /** Always 204. Invalidates every earlier verification link. */
  resendVerification(request: IdentifierRequest): Observable<void> {
    return this.http
      .post<void>(this.url(AUTH_ENDPOINT.RESEND_VERIFICATION), request)
      .pipe(mapApiError());
  }

  /**
   * Always 204 – also for unknown accounts, which get no mail. The mail links to a page hosted by
   * the API, where the new password is set; the app never sees the token.
   */
  forgotPassword(request: IdentifierRequest): Observable<void> {
    return this.http
      .post<void>(this.url(AUTH_ENDPOINT.FORGOT_PASSWORD), request)
      .pipe(mapApiError());
  }

  /** Irreversibly anonymises the account and all its data. */
  deleteAccount(): Observable<void> {
    return this.http.delete<void>(this.url(ME_ENDPOINT)).pipe(mapApiError());
  }

  /** A token (valid 5 minutes) for `GET data-export?token=…`, which downloads the user's data. */
  createDataExportToken(): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>(this.url(DATA_EXPORT_TOKEN_ENDPOINT), null)
      .pipe(mapApiError());
  }

  /** 204: the consent is withdrawn – and, as the terms are required, the account is deleted. */
  withdrawTermsConsent(): Observable<void> {
    return this.http
      .post<void>(this.url(WITHDRAW_TERMS_CONSENT_ENDPOINT), null)
      .pipe(mapApiError());
  }
}
