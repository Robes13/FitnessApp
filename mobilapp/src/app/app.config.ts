import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { ReminderService } from './core/services/reminders';
import { ThemeService } from './core/services/theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // HttpClient on the Fetch API (product lookups in Open Food Facts).
    provideHttpClient(withFetch()),
    // Component input binding: route and query parameters are bound directly to `input()` on pages.
    provideRouter(routes, withComponentInputBinding()),
    // Restores the saved theme (`data-theme` on <html>) before the first screen renders.
    provideAppInitializer(() => inject(ThemeService).initialize()),
    // Creating the service reschedules the reminders' local notifications on app start.
    provideAppInitializer(() => {
      inject(ReminderService);
    }),
  ],
};
