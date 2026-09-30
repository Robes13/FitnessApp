import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { STORAGE_KEY } from '../../constants/storage-key';
import { formatDecimal } from '../../utils/date-format';
import {
  FakeDocument,
  FakeStorage,
  createFakeDocument,
  createFakeStorage,
} from '../../testing/fake-document';
import { LanguageService } from './language';

describe('LanguageService', () => {
  let storage: FakeStorage;
  let document: FakeDocument;

  function setup(): LanguageService {
    document = createFakeDocument(storage);
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: document }] });
    TestBed.inject(TranslateService).setTranslation('en', { common: { back: 'Back' } });
    return TestBed.inject(LanguageService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  afterEach(async () => {
    // The number format is module state – put Danish back for the next spec.
    await TestBed.inject(LanguageService).set('da');
  });

  it('starts in Danish', async () => {
    const language = setup();
    await language.initialize();

    expect(language.language()).toBe('da');
    expect(document.documentElement.getAttribute('lang')).toBe('da');
  });

  it('restores the saved language', async () => {
    storage = createFakeStorage({ [STORAGE_KEY.LANGUAGE]: 'en' });
    const language = setup();
    await language.initialize();

    expect(language.language()).toBe('en');
  });

  it('ignores an unknown saved language', async () => {
    storage = createFakeStorage({ [STORAGE_KEY.LANGUAGE]: 'xx' });
    const language = setup();
    await language.initialize();

    expect(language.language()).toBe('da');
  });

  it('switches texts, number format and <html lang> live, and saves the choice', async () => {
    const language = setup();
    await language.set('en');

    expect(TestBed.inject(TranslateService).instant('common.back')).toBe('Back');
    expect(formatDecimal(74.5)).toBe('74.5');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(storage.getItem(STORAGE_KEY.LANGUAGE)).toBe('"en"');
  });
});
