import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { SignupPage } from './pages/signup-page/signup-page';

/**
 * `SignupPage` provides `SignupStateService` itself – not the route, whose injector Angular keeps
 * after the user leaves – so the draft starts over every time the flow is entered.
 */
export const SIGNUP_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: SignupPage }];
