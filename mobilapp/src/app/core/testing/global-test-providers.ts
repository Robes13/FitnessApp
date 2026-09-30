import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import da from '../../../i18n/da.json';

/**
 * Providers every spec gets (`providersFile` in `angular.json`):
 * - ngx-translate with the Danish texts loaded synchronously, so components and services render
 *   Danish exactly as in the app;
 * - `HttpClient` on Angular's testing backend, so no spec ever reaches the network. Answer
 *   requests with `TestBed.inject(HttpTestingController)`. A spec that tests the auth
 *   interceptor adds `provideHttpClient(withInterceptors([authInterceptor]))` and
 *   `provideHttpClientTesting()` itself.
 *
 * Only library code is imported here – importing app code into this file breaks the test build.
 */
const providers: (Provider | EnvironmentProviders)[] = [
  provideTranslateService({
    lang: 'da',
    fallbackLang: 'da',
    loader: provideTranslateLoader(() => ({ getTranslation: () => of(da) })),
  }),
  provideHttpClient(),
  provideHttpClientTesting(),
];

export default providers;
