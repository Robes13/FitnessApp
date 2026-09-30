import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_LANGUAGE } from '../../constants/language';
import { STORAGE_KEY } from '../../constants/storage-key';
import { Language } from '../../models/language';
import { setNumberLocale } from '../../utils/date-format';
import { isLanguage } from '../../utils/language';
import { StorageService } from '../storage/storage';

/**
 * The app's language (ngx-translate). Switching loads the language's texts and swaps them in
 * live – the `translate` pipe and `injectTranslate()` both follow along, so nothing reloads.
 * `<html lang>` and the number format follow too.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);
  private readonly translate = inject(TranslateService);
  private readonly state = signal<Language>(DEFAULT_LANGUAGE);

  readonly language = this.state.asReadonly();

  /** Restores the saved language. The app initializer waits for it, so the first screen is translated. */
  initialize(): Promise<void> {
    const stored = this.storage.read<unknown>(STORAGE_KEY.LANGUAGE);
    return this.apply(isLanguage(stored) ? stored : DEFAULT_LANGUAGE);
  }

  async set(language: Language): Promise<void> {
    await this.apply(language);
    this.storage.write(STORAGE_KEY.LANGUAGE, language);
  }

  private async apply(language: Language): Promise<void> {
    await firstValueFrom(this.translate.use(language));
    this.state.set(language);
    setNumberLocale(language);
    this.document.documentElement.setAttribute('lang', language);
  }
}
