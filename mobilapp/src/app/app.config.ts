import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { ThemeService } from './core/services/theme';

/** Appen er dansk: tekster, tal (`1.234,5`) og datoer. Locale-data registreres i `main.ts`. */
const APP_LOCALE = 'da';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Component input binding: route- og query-parametre bindes direkte til `input()` på sider.
    provideRouter(routes, withComponentInputBinding()),
    { provide: LOCALE_ID, useValue: APP_LOCALE },
    // Genskaber det gemte tema (`data-theme` på <html>), før den første skærm tegnes.
    provideAppInitializer(() => inject(ThemeService).initialize()),
  ],
};
