import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { ThemeService } from './core/services/theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Component input binding: route- og query-parametre bindes direkte til `input()` på sider.
    provideRouter(routes, withComponentInputBinding()),
    // Genskaber det gemte tema (`data-theme` på <html>), før den første skærm tegnes.
    provideAppInitializer(() => inject(ThemeService).initialize()),
  ],
};
