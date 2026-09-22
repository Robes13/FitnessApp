import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { LoginPage } from './pages/login-page/login-page';

/** Lazy loaded from `app.routes.ts` at `/login` (behind `guestGuard`). */
export const AUTH_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: LoginPage }];
