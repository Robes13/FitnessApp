import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { CollectionsPage } from './pages/collections-page/collections-page';
import { RecipePage } from './pages/recipe-page/recipe-page';

/** The list, a tab under the shell. */
export const COLLECTIONS_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: CollectionsPage }];

/**
 * The recipe is a full screen without a tab bar (the design's `navVisible`), so `app.routes.ts`
 * mounts it at `/samling/:recipeId` outside the shell – like Profile.
 */
export const RECIPE_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: RecipePage }];
