import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, from } from 'rxjs';
import da from '../../../../i18n/da.json';
import { DEFAULT_LANGUAGE } from '../../constants/language';
import { Language } from '../../models/language';
import { isLanguage } from '../../utils/language';

/** Danish is bundled (it's the fallback); the other languages are lazy chunks, loaded on first use. */
const TRANSLATIONS: Readonly<Record<Language, () => Promise<TranslationObject>>> = {
  da: () => Promise.resolve(da),
  en: () => import('../../../../i18n/en.json').then((file) => file.default),
};

/** Serves `src/i18n/<language>.json` from the bundle – no HTTP, so it works offline in the native app. */
@Injectable()
export class JsonTranslationLoader implements TranslateLoader {
  getTranslation(language: string): Observable<TranslationObject> {
    return from(TRANSLATIONS[isLanguage(language) ? language : DEFAULT_LANGUAGE]());
  }
}
