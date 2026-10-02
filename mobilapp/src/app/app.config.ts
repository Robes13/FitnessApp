import {
  ApplicationConfig,
  Injector,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { BackButtonService } from './core/services/back-button/back-button';
import { KeyboardService } from './core/services/keyboard/keyboard';
import { ReminderService } from './core/services/reminders/reminders';
import { SessionDataService } from './core/services/session-data/session-data';
import { SessionService } from './core/services/session/session';
import { ThemeService } from './core/services/theme/theme';
import { LanguageService } from './core/services/language/language';
import { JsonTranslationLoader } from './core/services/language/translation-loader';
import { DEFAULT_LANGUAGE } from './core/constants/language';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Texts from `src/i18n/<language>.json`; a missing key falls back to Danish.
    provideTranslateService({
      fallbackLang: DEFAULT_LANGUAGE,
      loader: provideTranslateLoader(JsonTranslationLoader),
    }),
    // Loads the saved language before the first screen renders, so it is never shown in the wrong one.
    // The reminders start after it: creating `ReminderService` reschedules the local notifications,
    // and their texts must be in the right language – so they are scheduled once, not twice.
    provideAppInitializer(() => {
      const injector = inject(Injector);
      return inject(LanguageService)
        .initialize()
        .then(() => {
          injector.get(ReminderService);
        });
    }),
    // HttpClient on the Fetch API (our API and Open Food Facts). The interceptor adds the bearer
    // and refreshes the token – for our API only.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Renews a restored session once (spec 1.5), then loads the signed-in user's data from the
    // API – the loads share that refresh if they need a token – and forgets it on log out.
    provideAppInitializer(() => {
      inject(SessionService).renewOnOpen();
      inject(SessionDataService);
    }),
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
  ],
};
