import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { ProfilePage } from './pages/profile-page/profile-page';

/**
 * Profile has one screen. The route sits outside the shell (`/profil`) because the page
 * isn't a tab – it's opened from the avatar on Home and therefore has no tab bar.
 */
export const PROFILE_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: ProfilePage }];
