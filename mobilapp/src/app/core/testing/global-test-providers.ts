import { Provider } from '@angular/core';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import da from '../../../i18n/da.json';

/**
 * Providers every spec gets (`providersFile` in `angular.json`): ngx-translate with the Danish
 * texts loaded synchronously, so components and services render Danish exactly as in the app.
 */
const providers: Provider[] = [
  provideTranslateService({
    lang: 'da',
    fallbackLang: 'da',
    loader: provideTranslateLoader(() => ({ getTranslation: () => of(da) })),
  }),
];

export default providers;
