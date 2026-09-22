import { DOCUMENT, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { APP_ROUTE } from '../constants/app-route';
import { STORAGE_KEY } from '../constants/storage-key';
import { SessionState } from '../models/session';
import { AuthApi } from './auth-api';
import { StorageService } from './storage';
import { UserProfileService } from './user-profile';

const LOGGED_OUT: SessionState = { isLoggedIn: false, isEmailVerified: false };

/**
 * Login state and email verification. Only the session is cleared on log out – profile,
 * food log and weigh-ins remain (the design's "Your data is kept").
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);
  private readonly authApi = inject(AuthApi);
  private readonly profile = inject(UserProfileService);
  private readonly state = signal<SessionState>(this.restore());

  readonly isLoggedIn: Signal<boolean> = computed(() => this.state().isLoggedIn);
  readonly isEmailVerified: Signal<boolean> = computed(() => this.state().isEmailVerified);

  /** On success the user is logged in and verified. An empty profile name is set to the username. */
  login(username: string, password: string): Observable<void> {
    return this.authApi.login(username, password).pipe(
      tap(() => {
        this.set({ isLoggedIn: true, isEmailVerified: true });
        if (!this.profile.profile().username.trim()) {
          this.profile.update({ username: username.trim() });
        }
      }),
    );
  }

  logout(): void {
    this.set(LOGGED_OUT);
  }

  /**
   * Deletes the account (GDPR): every app key in storage is removed, the session and the
   * profile are reset in memory, and the app is reloaded at login.
   *
   * The reload is deliberate: food log, weigh-ins, collections, theme etc. live in their
   * own root stores, and a full page load is the only way to reset all of them at once
   * without every store needing its own reset method.
   *
   * TODO: once the API exists, call the backend's delete-account endpoint here first, and
   * only clear local data after it has succeeded.
   */
  deleteAccount(): void {
    this.state.set(LOGGED_OUT);
    this.profile.resetToDefaults();
    // Cleared last, so the in-memory resets above can't write anything back.
    this.storage.clearAll();
    this.document.location.replace(new URL(APP_ROUTE.LOGIN, this.document.baseURI).href);
  }

  /**
   * Completes sign-up: the verification email is "sent", and the user is logged in but
   * unverified, so Home shows the verification sheet. `AuthApi.register` itself is called
   * by the signup flow, which knows the password.
   */
  completeSignup(): Observable<void> {
    return this.authApi
      .resendVerification()
      .pipe(tap(() => this.set({ isLoggedIn: true, isEmailVerified: false })));
  }

  markEmailVerified(): void {
    this.set({ ...this.state(), isEmailVerified: true });
  }

  resendVerification(): Observable<void> {
    return this.authApi.resendVerification();
  }

  /** Asks the backend; if it ever becomes `true`, the email is marked as verified. */
  checkVerification(): Observable<boolean> {
    return this.authApi.checkVerification().pipe(
      tap((verified) => {
        if (verified) {
          this.markEmailVerified();
        }
      }),
    );
  }

  private set(state: SessionState): void {
    this.state.set(state);
    this.storage.write(STORAGE_KEY.SESSION, state);
  }

  private restore(): SessionState {
    const stored = this.storage.read<Partial<SessionState>>(STORAGE_KEY.SESSION);
    return {
      isLoggedIn: stored?.isLoggedIn === true,
      isEmailVerified: stored?.isEmailVerified === true,
    };
  }
}
