import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { ForgotPasswordPage } from './pages/forgot-password-page/forgot-password-page';

/**
 * Lazy loadet af `app.routes.ts` på `/glemt-adgangskode` (bag `guestGuard`). De fire trin er
 * intern tilstand i `ForgotPasswordPage` og har derfor ikke hver sin rute.
 */
export const FORGOT_PASSWORD_ROUTES: Routes = [
  { path: APP_ROUTE.ROOT, component: ForgotPasswordPage },
];
