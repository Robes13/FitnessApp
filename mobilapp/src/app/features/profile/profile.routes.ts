import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { ProfilePage } from './pages/profile-page/profile-page';

/**
 * Profil har én skærm. Ruten ligger uden for shell'en (`/profil`), fordi siden ikke er en
 * fane – den åbnes fra avataren på Hjem og har derfor ingen tab bar.
 */
export const PROFILE_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: ProfilePage }];
