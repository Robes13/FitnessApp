import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { ShellLayout } from './pages/shell-layout/shell-layout';

/** Tab-skærmene. `ShellLayout` tegner tab baren, børnene lazy loades pr. feature. */
export const SHELL_ROUTES: Routes = [
  {
    path: APP_ROUTE.ROOT,
    component: ShellLayout,
    children: [
      { path: APP_ROUTE.ROOT, pathMatch: 'full', redirectTo: APP_ROUTE.HOME },
      {
        path: APP_ROUTE.HOME,
        loadChildren: () => import('../home/home.routes').then((m) => m.HOME_ROUTES),
      },
      {
        path: APP_ROUTE.FOOD,
        loadChildren: () => import('../food/food.routes').then((m) => m.FOOD_ROUTES),
      },
      {
        path: APP_ROUTE.WEIGHT,
        loadChildren: () => import('../weight/weight.routes').then((m) => m.WEIGHT_ROUTES),
      },
      {
        path: APP_ROUTE.COLLECTIONS,
        loadChildren: () =>
          import('../collections/collections.routes').then((m) => m.COLLECTIONS_ROUTES),
      },
      {
        path: APP_ROUTE.HISTORY,
        loadChildren: () => import('../history/history.routes').then((m) => m.HISTORY_ROUTES),
      },
    ],
  },
];
