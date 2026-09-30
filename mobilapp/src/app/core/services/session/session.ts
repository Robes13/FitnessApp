import { HttpStatusCode } from '@angular/common/http';
import { DOCUMENT, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  defer,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';
import { API_ERROR_MESSAGE_KEY } from '../../constants/api';
import { APP_PATH, APP_ROUTE } from '../../constants/app-route';
import { AUTH_ERROR_MESSAGE_KEY, TOKEN_REFRESH_MARGIN_MS } from '../../constants/auth';
import { DEVICE_STORAGE_KEYS, STORAGE_KEY } from '../../constants/storage-key';
import { ApiError } from '../../models/api-error';
import { AuthResponse, UserDto } from '../../models/auth';
import { UserProfile } from '../../models/profile';
import { AuthTokens, SessionState, SessionStatus } from '../../models/session';
import { parseApiDateTime, toApiError } from '../../utils/api';
import { currentTimeZoneId } from '../../utils/date-format';
import { NOW } from '../../utils/now';
import { AuthApi } from '../auth-api/auth-api';
import { normalizeAuthToken, toRegisterRequest } from '../auth-api/auth-mapping';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';
import { StorageService } from '../storage/storage';
import { UserProfileService } from '../user-profile/user-profile';

const GUEST: SessionState = { status: 'guest', email: null, userId: null, tokens: null };
const NO_SESSION: ApiError = {
  messageKey: API_ERROR_MESSAGE_KEY.REQUEST_FAILED,
  status: HttpStatusCode.Unauthorized,
};
const VERIFICATION_UNCHECKABLE: ApiError = {
  messageKey: AUTH_ERROR_MESSAGE_KEY.VERIFICATION_UNCHECKABLE,
};

/**
 * The session against the API: `guest` → (register) `pending-verification` → (verify + login)
 * `authenticated`. Log out only ends the session – the local data stays on the device (the
 * design's "Your data is kept") – but when a *different* account registers or signs in here,
 * the previous account's local data is cleared first.
 *
 * ponytail: the tokens are persisted in `localStorage` (via `StorageService`) like the rest of
 * the app's state; secure storage (Keychain/Keystore) is the upgrade path.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly authApi = inject(AuthApi);
  private readonly profile = inject(UserProfileService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);
  private readonly state = signal<SessionState>(this.restore());

  /**
   * The sign-up password, kept **only in memory**: the API issues no tokens before the e-mail is
   * verified, so this is what logs the user in afterwards. After an app restart it's gone, and
   * the user logs in by hand.
   */
  private pendingPassword: string | null = null;
  /** `email/verify` succeeded but the login after it failed – the token is used up by now. */
  private verified = false;
  /** The one refresh in progress – concurrent callers share it (the API rotates refresh tokens). */
  private refreshInFlight: Observable<string> | null = null;

  readonly status: Signal<SessionStatus> = computed(() => this.state().status);
  readonly email: Signal<string | null> = computed(() => this.state().email);
  /** Signed up or signed in – the guards let the user past login. */
  readonly isLoggedIn: Signal<boolean> = computed(() => this.status() !== 'guest');
  /**
   * Holds tokens (the e-mail is verified) – every `/me/**` call waits for this, not for
   * `isLoggedIn`. Home stays locked behind the verification sheet until it is `true`.
   */
  readonly isAuthenticated: Signal<boolean> = computed(() => this.status() === 'authenticated');

  /** Creates the account. The API has already sent the verification e-mail – no resend here. */
  register(profile: UserProfile, password: string, passwordConfirmation: string): Observable<void> {
    const request = toRegisterRequest(
      profile,
      password,
      passwordConfirmation,
      currentTimeZoneId(),
      this.calculator,
    );
    return this.authApi.register(request).pipe(
      map((user) => {
        this.forgetOtherAccount(user.userId);
        this.pendingPassword = password;
        this.verified = false;
        this.set({
          status: 'pending-verification',
          email: user.email,
          userId: user.userId,
          tokens: null,
        });
      }),
    );
  }

  /**
   * Verifies the pasted token and logs in with the sign-up password. Without it (the app has
   * restarted since sign-up) the user becomes a guest and is sent to login with the e-mail filled
   * in. If an earlier verify went through but its login failed, only the login is retried.
   */
  verifyEmail(token: string): Observable<void> {
    const verify = this.verified
      ? of(undefined)
      : this.authApi.verifyEmail({ token: normalizeAuthToken(token) });
    return verify.pipe(
      switchMap(() => {
        const email = this.state().email;
        if (email !== null && this.pendingPassword !== null) {
          this.verified = true;
          return this.login(email, this.pendingPassword);
        }
        this.signOut();
        void this.router.navigateByUrl(APP_PATH.LOGIN);
        return of(undefined);
      }),
    );
  }

  /**
   * "Check again". The API has no status endpoint, so this tries to log in with the sign-up
   * password: 200 = verified (and logged in), 401 = not yet. Without the password (the app has
   * restarted) nothing can be checked, so it fails with a hint to paste the code or log in.
   */
  checkVerification(): Observable<boolean> {
    const email = this.state().email;
    if (email === null || this.pendingPassword === null) {
      return throwError(() => VERIFICATION_UNCHECKABLE);
    }
    return this.login(email, this.pendingPassword).pipe(
      map(() => true),
      catchError((error: unknown) =>
        toApiError(error).status === HttpStatusCode.Unauthorized
          ? of(false)
          : throwError(() => error),
      ),
    );
  }

  resendVerification(): Observable<void> {
    return this.authApi.resendVerification({ email: this.state().email ?? '' });
  }

  /**
   * On success the user is authenticated. Another account than the last one on this device
   * starts from a clean local profile; an empty profile name and e-mail are taken from the account.
   */
  login(email: string, password: string): Observable<void> {
    return this.authApi.login({ email: email.trim(), password }).pipe(
      map((response) => {
        this.forgetOtherAccount(response.user.userId);
        this.authenticate(response);
        this.fillProfileFrom(response.user);
      }),
    );
  }

  /**
   * Revokes the current refresh token, then ends the session. Best effort: the session ends
   * locally even if the server can't be reached – the token then simply expires.
   */
  logout(): Observable<void> {
    return defer(() =>
      this.state().tokens === null ? of(undefined) : this.revokeRefreshToken(),
    ).pipe(
      // Deliberately swallowed: logging out must never fail for the user.
      catchError(() => of(undefined)),
      map(() => this.signOut()),
    );
  }

  /**
   * Deletes the account (GDPR) with `DELETE /me`. Only after the API has confirmed it, every app
   * key in storage is removed and the app is reloaded at login, which starts every service over
   * as a guest. The session is deliberately not changed in memory first: stores would react to
   * it and could write to storage again before the page is gone. On an error nothing is deleted.
   */
  deleteAccount(): Observable<void> {
    return this.authApi.deleteAccount().pipe(
      map(() => {
        this.storage.clearAll();
        this.document.location.replace(new URL(APP_ROUTE.LOGIN, this.document.baseURI).href);
      }),
    );
  }

  /**
   * A valid access token – refreshed first when it expires within `TOKEN_REFRESH_MARGIN_MS` –
   * or `null` without tokens. The auth interceptor calls this for every API request.
   */
  accessToken(): Observable<string | null> {
    const tokens = this.state().tokens;
    if (tokens === null) {
      return of(null);
    }
    const expiresInMs =
      parseApiDateTime(tokens.accessTokenExpiresAt).getTime() - this.now().getTime();
    return expiresInMs > TOKEN_REFRESH_MARGIN_MS ? of(tokens.accessToken) : this.refresh();
  }

  /**
   * New tokens for the refresh token. Single-flight: concurrent callers share one request, as
   * the API rotates the refresh token and a second parallel refresh would get a 401. It runs to
   * the end even if every caller unsubscribes (no `refCount`), so the rotated tokens are never
   * lost. If the API rejects the refresh token, the session ends and the user is sent to login.
   * An answer that arrives after the session has ended or changed is not stored.
   */
  refresh(): Observable<string> {
    const refreshToken = this.state().tokens?.refreshToken;
    if (refreshToken === undefined) {
      return throwError(() => NO_SESSION);
    }
    const stillCurrent = (): boolean => this.state().tokens?.refreshToken === refreshToken;
    this.refreshInFlight ??= this.authApi.refresh({ refreshToken }).pipe(
      map((response) => {
        if (stillCurrent()) {
          this.authenticate(response);
        }
        return response.accessToken;
      }),
      catchError((error: unknown) => {
        if (isRejection(toApiError(error).status) && stillCurrent()) {
          this.signOut();
          void this.router.navigateByUrl(APP_PATH.LOGIN);
        }
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay(1),
    );
    return this.refreshInFlight;
  }

  /**
   * `POST auth/logout` with the refresh token as it is when the call is sent – after a refresh in
   * flight and after a proactive one. If the API rejects the bearer anyway (e.g. the device clock
   * is behind), the tokens are refreshed once and the *new* refresh token is revoked; the auth
   * interceptor doesn't retry logout itself, as it would resend the old body.
   */
  private revokeRefreshToken(): Observable<void> {
    const revoke = defer(() =>
      this.authApi.logout({ refreshToken: this.state().tokens?.refreshToken ?? '' }),
    );
    const ready: Observable<string | null> = this.refreshInFlight ?? this.accessToken();
    return ready.pipe(
      switchMap(() => revoke),
      catchError((error: unknown) =>
        toApiError(error).status === HttpStatusCode.Unauthorized
          ? this.refresh().pipe(switchMap(() => revoke))
          : throwError(() => error),
      ),
    );
  }

  private authenticate({ user, ...tokens }: AuthResponse): void {
    this.pendingPassword = null;
    this.verified = false;
    this.set({ status: 'authenticated', email: user.email, userId: user.userId, tokens });
  }

  /**
   * Another account than the last one registered or signed in on this device: its local data
   * (profile, logs, caches) must not show up for this one. Device settings (theme, language)
   * stay. Stores holding data in memory have already been reset when the session became a guest.
   */
  private forgetOtherAccount(userId: number): void {
    const previous = this.state().userId;
    if (previous === null || previous === userId) {
      return;
    }
    this.storage.clearAll(DEVICE_STORAGE_KEYS);
    this.profile.resetToDefaults();
  }

  private fillProfileFrom(user: UserDto): void {
    const { username, email } = this.profile.profile();
    if (!username.trim() || !email.trim()) {
      this.profile.update({
        username: username.trim() || user.username,
        email: email.trim() || user.email,
      });
    }
  }

  /** Back to guest. The e-mail stays, so the login form is filled in, and so does the account id. */
  private signOut(): void {
    this.pendingPassword = null;
    this.verified = false;
    const { email, userId } = this.state();
    this.set({ ...GUEST, email, userId });
  }

  private set(state: SessionState): void {
    this.state.set(state);
    this.storage.write(STORAGE_KEY.SESSION, state);
  }

  /**
   * The stored session. Anything else – including the old `{ isLoggedIn, isEmailVerified }`
   * shape from before the API, and a session whose refresh token has expired – is a guest.
   */
  private restore(): SessionState {
    const stored = this.storage.read<Partial<SessionState>>(STORAGE_KEY.SESSION);
    const email = typeof stored?.email === 'string' ? stored.email : null;
    const userId = typeof stored?.userId === 'number' ? stored.userId : null;
    if (
      stored?.status === 'authenticated' &&
      email !== null &&
      userId !== null &&
      isAuthTokens(stored.tokens) &&
      parseApiDateTime(stored.tokens.refreshTokenExpiresAt).getTime() > this.now().getTime()
    ) {
      return { status: 'authenticated', email, userId, tokens: stored.tokens };
    }
    if (stored?.status === 'pending-verification' && email !== null) {
      return { status: 'pending-verification', email, userId, tokens: null };
    }
    return { ...GUEST, email, userId };
  }
}

/** A 4xx from `refresh`: the refresh token is dead. A network or server error is not. */
function isRejection(status: number | undefined): boolean {
  return (
    status !== undefined &&
    status >= HttpStatusCode.BadRequest &&
    status < HttpStatusCode.InternalServerError
  );
}

function isAuthTokens(value: unknown): value is AuthTokens {
  const tokens = value as Partial<AuthTokens> | null | undefined;
  return (
    typeof tokens?.accessToken === 'string' &&
    typeof tokens.accessTokenExpiresAt === 'string' &&
    typeof tokens.refreshToken === 'string' &&
    typeof tokens.refreshTokenExpiresAt === 'string'
  );
}
