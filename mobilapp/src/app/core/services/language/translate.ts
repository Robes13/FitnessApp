import { inject } from '@angular/core';
import { InterpolationParameters, TranslateService } from '@ngx-translate/core';

/** Looks up a key in the active language: `t('weight.view.lastWeighed', { day })`. */
export type Translate = (key: string, params?: InterpolationParameters) => string;

/**
 * A `Translate` for TypeScript code. It reads the current language, so a `computed()` that
 * calls it recomputes when the user switches language. Call it in an injection context
 * (a field initializer); templates use the `translate` pipe instead.
 */
export function injectTranslate(): Translate {
  const translate = inject(TranslateService);
  return (key, params) => {
    translate.currentLang();
    return String(translate.instant(key, params));
  };
}
