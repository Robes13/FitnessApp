import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { ForgotPasswordPage } from './pages/forgot-password-page/forgot-password-page';

/**
 * Lazy loaded from `app.routes.ts` at `/glemt-adgangskode` (behind `guestGuard`). The form and its
 * "sent" state are internal state in `ForgotPasswordPage`, so there is one route.
 */
export const FORGOT_PASSWORD_ROUTES: Routes = [
  { path: APP_ROUTE.ROOT, component: ForgotPasswordPage },
];
