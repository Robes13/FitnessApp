import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { LoginPage } from './pages/login-page/login-page';

/** Lazy loadet af `app.routes.ts` på `/login` (bag `guestGuard`). */
export const AUTH_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: LoginPage }];
