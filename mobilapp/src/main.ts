import { registerLocaleData } from '@angular/common';
import localeDa from '@angular/common/locales/da';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Dansk talformat og datoer (`LOCALE_ID` er 'da' i app.config.ts).
registerLocaleData(localeDa);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
