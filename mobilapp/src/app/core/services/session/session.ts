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
import { TOKEN_REFRESH_MARGIN_MS } from '../../constants/auth';
import { DEVICE_STORAGE_KEYS, STORAGE_KEY } from '../../constants/storage-key';
import { ApiError } from '../../models/api-error';
import { AuthResponse } from '../../models/auth';
import { UserProfile } from '../../models/profile';
import { AuthTokens, SessionState, SessionStatus } from '../../models/session';
import { parseApiDateTime, toApiError } from '../../utils/api';
import { currentTimeZoneId } from '../../utils/date-format';
import { NOW } from '../../utils/now';
import { AuthApi } from '../auth-api/auth-api';
import { toRegisterRequest } from '../auth-api/auth-mapping';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';
import { StorageService } from '../storage/storage';
import { UserProfileService } from '../user-profile/user-profile';

const GUEST: SessionState = { status: 'guest', email: null, userId: null, tokens: null };
const NO_SESSION: ApiError = {
  messageKey: API_ERROR_MESSAGE_KEY.REQUEST_FAILED,
  status: HttpStatusCode.Unauthorized,
};

/**
 * The session against the API: `guest` → (register, or a login before the e-mail is verified)
 * `pending-verification` → (the link in the mail, then a login) `authenticated`. Log out only
 * ends the session – the local data stays on the device (the design's "Your data is kept") – but
 * when a *different* account registers or signs in here, the previous account's local data is
 * cleared first.
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
   * The identifier and password of the account waiting for its e-mail, kept **only in memory**:
   * the API issues no tokens before the e-mail is verified, so `checkVerification()` logs in with
   * them until it works. After an app restart they're gone, and the user logs in by hand (1.1-6a).
   */
  private pending: { identifier: string; password: string } | null = null;
  /** The one refresh in progress – concurrent callers share it (the API may rotate the token). */
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
        this.pending = { identifier: user.email, password };
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
   * Whether the e-mail has been verified by now. The API has no status endpoint (it would allow
   * enumeration), so this logs in with the credentials in memory: 200 authenticates (`true`), 403
   * keeps waiting (`false`). With nothing pending (the app has restarted) it is `false`.
   */
  checkVerification(): Observable<boolean> {
    return this.pending === null
      ? of(false)
      : this.login(this.pending.identifier, this.pending.password).pipe(
          map(() => this.isAuthenticated()),
        );
  }

  /** A new link for the pending account, by the identifier it signed up or logged in with. */
  resendVerification(): Observable<void> {
    return this.authApi.resendVerification({
      emailOrUsername: this.pending?.identifier ?? this.state().email ?? '',
    });
  }

  /**
   * Logs in with an e-mail or a username. 200: authenticated – another account than the last one
   * on this device starts from a clean local profile (the profile's load then fetches the account).
   * 403 (right password, e-mail not verified): no tokens – the session waits for the verification
   * with the credentials in memory and completes normally, so the login page goes to Home, where
   * the verification sheet opens. Everything else fails with an `ApiError` (`loginErrorKey`).
   */
  login(identifier: string, password: string): Observable<void> {
    const emailOrUsername = identifier.trim();
    return this.authApi.login({ emailOrUsername, password }).pipe(
      map((response) => {
        this.forgetOtherAccount(response.user.userId);
        this.authenticate(response);
      }),
      catchError((error: unknown) => {
        if (toApiError(error).status !== HttpStatusCode.Forbidden) {
          return throwError(() => error);
        }
        this.pending = { identifier: emailOrUsername, password };
        this.set({
          status: 'pending-verification',
          // Like the API: an identifier with `@` is an e-mail; a username tells no address.
          email: emailOrUsername.includes('@') ? emailOrUsername.toLowerCase() : null,
          userId: this.state().userId,
          tokens: null,
        });
        return of(undefined);
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
   * Spec 1.5: one refresh when the app opens with a restored session – the API keeps a refresh
   * token issued today (UTC) and rotates an older one to 30 days from now. Called by an app
   * initializer, before the stores load; their calls share this refresh if they need a token.
   */
  renewOnOpen(): void {
    if (this.isAuthenticated()) {
      // Nothing left to handle: a rejected refresh token has already ended the session (→ login),
      // and a network or server error keeps it – the next call that needs a token refreshes again.
      this.refresh().subscribe({ error: () => undefined });
    }
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
   * the first refresh of a UTC day rotates the refresh token, and a second parallel refresh with
   * the old one would get a 401. It runs to the end even if every caller unsubscribes (no
   * `refCount`), so the rotated tokens are never lost. If the API rejects the refresh token, the
   * session ends and the user is sent to login. An answer that arrives after the session has
   * ended or changed is not stored.
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
    this.pending = null;
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

  /** Back to guest. The e-mail stays, so the login form is filled in, and so does the account id. */
  private signOut(): void {
    this.pending = null;
    const { email, userId } = this.state();
    this.set({ ...GUEST, email, userId });
  }

  private set(state: SessionState): void {
    this.state.set(state);
    this.storage.write(STORAGE_KEY.SESSION, state);
  }

  /**
   * The stored session. Anything else – the old `{ isLoggedIn, isEmailVerified }` shape from
   * before the API, a session whose refresh token has expired, and a pending one (its password was
   * only in memory, spec 1.1-6a) – is a guest that keeps the e-mail and the account id.
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
