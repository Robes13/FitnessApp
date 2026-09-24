import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { APP_PATH } from '../constants/app-route';
import { SessionService } from '../services/session/session';

/** Requires login. Not logged in → `/login`. */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isLoggedIn() ? true : router.createUrlTree([APP_PATH.LOGIN]);
};

/** Guests only (login, forgot password, sign up). Logged in → `/hjem`. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isLoggedIn() ? router.createUrlTree([APP_PATH.HOME]) : true;
};
