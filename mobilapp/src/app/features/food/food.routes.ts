import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { FoodPage } from './pages/food-page/food-page';
import { FoodViewService } from './services/food-view';

export const FOOD_ROUTES: Routes = [
  {
    path: APP_ROUTE.ROOT,
    component: FoodPage,
    providers: [FoodViewService],
  },
];
