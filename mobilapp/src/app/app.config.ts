import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { BackButtonService } from './core/services/back-button/back-button';
import { KeyboardService } from './core/services/keyboard/keyboard';
import { ReminderService } from './core/services/reminders/reminders';
import { ThemeService } from './core/services/theme/theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // HttpClient on the Fetch API (product lookups in Open Food Facts).
    provideHttpClient(withFetch()),
    // Component input binding: route and query parameters are bound directly to `input()` on pages.
    provideRouter(routes, withComponentInputBinding()),
    // Restores the saved theme (`data-theme` on <html>) before the first screen renders.
    provideAppInitializer(() => inject(ThemeService).initialize()),
    // Starts listening to the on-screen keyboard, so the layout makes room for it.
    provideAppInitializer(() => {
      inject(KeyboardService);
    }),
    // Android back closes the open sheet or goes back, instead of closing the app.
    provideAppInitializer(() => {
      inject(BackButtonService);
    }),
    // Creating the service reschedules the reminders' local notifications on app start.
    provideAppInitializer(() => {
      inject(ReminderService);
    }),
  ],
};
