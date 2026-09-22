import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { AUTH_ERROR_MESSAGE } from '../constants/auth';
import { ApiError } from '../models/api-error';
import { UserProfile } from '../models/profile';

/**
 * The client for the auth backend.
 *
 * There is no backend yet, so every call fails with an `ApiError` the user can read.
 * The methods are the contract the HTTP implementation needs to fulfill – login, sign-up
 * and password reset only work once it's in place.
 *
 * All field validation lives in the forms, not here.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  login(_username: string, _password: string): Observable<never> {
    return this.notImplemented();
  }

  register(_profile: UserProfile, _password: string): Observable<never> {
    return this.notImplemented();
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

  resendVerification(): Observable<never> {
    return this.notImplemented();
  }

  checkVerification(): Observable<never> {
    return this.notImplemented();
  }

  private notImplemented(): Observable<never> {
    const error: ApiError = { message: AUTH_ERROR_MESSAGE.NO_BACKEND };
    return throwError(() => error);
  }
}
