import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import en from '../../../i18n/en.json';
import { Translate, injectTranslate } from '../services/language/translate';
import { formatQuantity, formatQuantityUnit } from './quantity';

describe('quantity', () => {
  let t: Translate;

  beforeEach(() => {
    t = TestBed.runInInjectionContext(() => injectTranslate());
  });

  it('writes a portion in the plural from 2 up, as Danish does', () => {
    expect(formatQuantity(t, '1 portion')).toBe('1 portion');
    expect(formatQuantity(t, '2 portion')).toBe('2 portioner');
    expect(formatQuantity(t, '1.5 portion')).toBe('1.5 portioner');
    expect(formatQuantityUnit(t, 'portion', 3)).toBe('portioner');
    expect(formatQuantity(t, '2 stk')).toBe('2 stk');
  });

  it('leaves grams, millilitres and units the app never creates as they are', () => {
    expect(formatQuantity(t, '150 g')).toBe('150 g');
    expect(formatQuantity(t, '330 ml')).toBe('330 ml');
    expect(formatQuantity(t, '2 cup')).toBe('2 cup');
    expect(formatQuantityUnit(t, 'g', 2)).toBe('g');
  });

  it('names the counted units in the active language', () => {
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', en);
    translate.use('en');

    expect(formatQuantity(t, '1 portion')).toBe('1 serving');
    expect(formatQuantity(t, '2 portion')).toBe('2 servings');
    expect(formatQuantity(t, '1 stk')).toBe('1 pc');
    expect(formatQuantity(t, '3 stk')).toBe('3 pcs');
  });
});
