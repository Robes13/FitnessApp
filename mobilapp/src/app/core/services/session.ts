import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { STORAGE_KEY } from '../constants/storage-key';
import { SessionState } from '../models/session';
import { AuthApi } from './auth-api';
import { StorageService } from './storage';
import { UserProfileService } from './user-profile';

const LOGGED_OUT: SessionState = { isLoggedIn: false, isEmailVerified: false };

/**
 * Login-tilstand og e-mail-bekræftelse. Kun sessionen ryddes ved log ud – profil, madlog og
 * vejninger bliver liggende (designets "Dine data bliver gemt").
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly storage = inject(StorageService);
  private readonly authApi = inject(AuthApi);
  private readonly profile = inject(UserProfileService);
  private readonly state = signal<SessionState>(this.restore());

  readonly isLoggedIn: Signal<boolean> = computed(() => this.state().isLoggedIn);
  readonly isEmailVerified: Signal<boolean> = computed(() => this.state().isEmailVerified);

  /** Ved succes er brugeren logget ind og bekræftet. Et tomt profilnavn sættes til brugernavnet. */
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
   * Afslutter oprettelsen: bekræftelsesmailen "sendes", og brugeren er logget ind men
   * ubekræftet, så Hjem viser bekræftelses-arket. Selve `AuthApi.register` kaldes af
   * signup-flowet, der kender adgangskoden.
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

  /** Spørger backenden; bliver den en dag `true`, markeres mailen som bekræftet. */
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
