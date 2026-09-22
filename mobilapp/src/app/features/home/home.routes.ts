import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { HomePage } from './pages/home-page/home-page';

export const HOME_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: HomePage }];
