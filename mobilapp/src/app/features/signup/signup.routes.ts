import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { SignupPage } from './pages/signup-page/signup-page';
import { SignupStateService } from './services/signup-state';

/**
 * `SignupStateService` leveres af ruten – ikke i roden – så kladden lever lige så længe
 * som flowet og starter forfra, hvis brugeren forlader det og kommer tilbage.
 */
export const SIGNUP_ROUTES: Routes = [
  { path: APP_ROUTE.ROOT, component: SignupPage, providers: [SignupStateService] },
];
