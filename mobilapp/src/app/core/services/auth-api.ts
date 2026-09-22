import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map, switchMap, throwError, timer } from 'rxjs';
import { AUTH_ERROR_MESSAGE } from '../constants/auth';
import { PASSWORD_MIN_LENGTH, RESET_CODE_LENGTH } from '../constants/nutrition';
import { ApiError } from '../models/api-error';
import { UserProfile } from '../models/profile';
import { NutritionCalculator } from './nutrition-calculator';

/** Forsinkelse på mock-backendens svar (login, nulstilling af kode m.m.). */
const DEFAULT_DELAY_MS = 600;

/** Svartid for mock-backenden. Sæt til 0 i tests. */
export const AUTH_API_DELAY_MS = new InjectionToken<number>('AUTH_API_DELAY_MS', {
  providedIn: 'root',
  factory: () => DEFAULT_DELAY_MS,
});

const RESET_CODE_PATTERN = new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`);

/**
 * Mock af en auth-backend. Alle kald svarer efter `AUTH_API_DELAY_MS` og fejler med en
 * `ApiError`, hvis input ikke er gyldigt. Der er ingen rigtige konti.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly delayMs = inject(AUTH_API_DELAY_MS);
  private readonly calculator = inject(NutritionCalculator);

  login(username: string, password: string): Observable<void> {
    if (!username.trim() || !password) {
      return this.fail(AUTH_ERROR_MESSAGE.MISSING_CREDENTIALS);
    }
    return this.respond();
  }

  register(profile: UserProfile, password: string): Observable<void> {
    if (!profile.username.trim()) {
      return this.fail(AUTH_ERROR_MESSAGE.MISSING_CREDENTIALS);
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return this.fail(AUTH_ERROR_MESSAGE.PASSWORD_TOO_SHORT);
    }
    return this.respond();
  }

  requestPasswordReset(email: string): Observable<void> {
    if (!this.calculator.isValidEmail(email)) {
      return this.fail(AUTH_ERROR_MESSAGE.INVALID_EMAIL);
    }
    return this.respond();
  }

  /** Enhver firecifret kode accepteres. */
  verifyResetCode(code: string): Observable<void> {
    if (!RESET_CODE_PATTERN.test(code)) {
      return this.fail(AUTH_ERROR_MESSAGE.INVALID_CODE);
    }
    return this.respond();
  }

  resetPassword(password: string): Observable<void> {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return this.fail(AUTH_ERROR_MESSAGE.PASSWORD_TOO_SHORT);
    }
    return this.respond();
  }

  resendVerification(): Observable<void> {
    return this.respond();
  }

  /** Designet viser altid "Ikke bekræftet" – mailen bliver aldrig bekræftet af backenden. */
  checkVerification(): Observable<boolean> {
    return timer(this.delayMs).pipe(map(() => false));
  }

  private respond(): Observable<void> {
    return timer(this.delayMs).pipe(map(() => undefined));
  }

  private fail(message: string): Observable<never> {
    const error: ApiError = { message };
    return timer(this.delayMs).pipe(switchMap(() => throwError(() => error)));
  }
}
