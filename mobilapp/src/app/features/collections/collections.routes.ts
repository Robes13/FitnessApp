import { Routes } from '@angular/router';
import { APP_ROUTE, ROUTE_PARAM } from '../../core/constants/app-route';
import { ROUTE_DATA } from '../../core/constants/route-data';
import { CollectionsPage } from './pages/collections-page/collections-page';
import { RecipePage } from './pages/recipe-page/recipe-page';

export const COLLECTIONS_ROUTES: Routes = [
  { path: APP_ROUTE.ROOT, component: CollectionsPage },
  {
    path: `:${ROUTE_PARAM.RECIPE_ID}`,
    component: RecipePage,
    // The recipe is a full screen without a tab bar (the design's `navVisible`).
    data: { [ROUTE_DATA.HIDE_TAB_BAR]: true },
  },
];
