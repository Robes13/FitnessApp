import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { ReminderService } from './core/services/reminders';
import { ThemeService } from './core/services/theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
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
