import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { ForgotPasswordPage } from './pages/forgot-password-page/forgot-password-page';

/**
 * Lazy loaded from `app.routes.ts` at `/glemt-adgangskode` (behind `guestGuard`). The four steps
 * are internal state in `ForgotPasswordPage` and therefore don't each have their own route.
 */
export const FORGOT_PASSWORD_ROUTES: Routes = [
  { path: APP_ROUTE.ROOT, component: ForgotPasswordPage },
];
