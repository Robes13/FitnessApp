import { Routes } from '@angular/router';
import { APP_ROUTE } from '../../core/constants/app-route';
import { HistoryPage } from './pages/history-page/history-page';

export const HISTORY_ROUTES: Routes = [{ path: APP_ROUTE.ROOT, component: HistoryPage }];
