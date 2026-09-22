import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { WeightPage } from './pages/weight-page/weight-page';

export const WEIGHT_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: WeightPage }];
