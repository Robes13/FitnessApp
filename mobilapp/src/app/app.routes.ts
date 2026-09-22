import { Routes } from '@angular/router';
import { APP_ROUTE } from './core/constants/app-route';
import { authGuard, guestGuard } from './core/guards/auth.guard';

/**
 * Topniveau-routing. Alle features lazy loades. Gæste-skærme (login, glemt kode, opret) er
 * kun for udloggede; Profil og shell'en (tabs) kræver login. Ukendte stier ender på Hjem –
 * er brugeren ikke logget ind, sender `authGuard` videre til login.
 */
export const routes: Routes = [
  {
    path: APP_ROUTE.LOGIN,
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: APP_ROUTE.FORGOT_PASSWORD,
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./features/auth/forgot-password.routes').then((m) => m.FORGOT_PASSWORD_ROUTES),
  },
  {
    path: APP_ROUTE.SIGNUP,
    canActivate: [guestGuard],
    loadChildren: () => import('./features/signup/signup.routes').then((m) => m.SIGNUP_ROUTES),
  },
  {
    path: APP_ROUTE.PROFILE,
    canActivate: [authGuard],
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: APP_ROUTE.ROOT,
    canActivate: [authGuard],
    loadChildren: () => import('./features/shell/shell.routes').then((m) => m.SHELL_ROUTES),
  },
  { path: '**', redirectTo: APP_ROUTE.HOME },
];
