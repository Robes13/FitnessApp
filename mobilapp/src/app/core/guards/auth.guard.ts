import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { APP_PATH } from '../constants/app-route';
import { SessionService } from '../services/session';

/** Kræver login. Ikke logget ind → `/login`. */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isLoggedIn() ? true : router.createUrlTree([APP_PATH.LOGIN]);
};

/** Kun for gæster (login, glemt kode, opret). Logget ind → `/hjem`. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isLoggedIn() ? router.createUrlTree([APP_PATH.HOME]) : true;
};
