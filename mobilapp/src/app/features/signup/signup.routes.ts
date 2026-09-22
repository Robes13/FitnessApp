import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { SignupPage } from './pages/signup-page/signup-page';
import { SignupStateService } from './services/signup-state';

/**
 * `SignupStateService` is provided by the route – not at the root – so the draft lives just as
 * long as the flow and starts over if the user leaves it and comes back.
 */
export const SIGNUP_ROUTES: Routes = [
  { path: APP_ROUTE.ROOT, component: SignupPage, providers: [SignupStateService] },
];
