import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../constants/storage-key';
import {
  FakeDocument,
  FakeStorage,
  createFakeDocument,
  createFakeStorage,
} from '../testing/fake-document';
import { ThemeService } from './theme';

describe('ThemeService', () => {
  let storage: FakeStorage;
  let document: FakeDocument;

  function setup(): ThemeService {
    document = createFakeDocument(storage);
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: document }] });
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('defaults to dark and applies it to <html>', () => {
    const theme = setup();

    expect(theme.theme()).toBe('dark');
    expect(theme.isLight()).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(storage.getItem(STORAGE_KEY.THEME)).toBeNull();
  });

  it('toggles to light, updates <html> and persists', () => {
    const theme = setup();

    theme.toggle();

    expect(theme.theme()).toBe('light');
    expect(theme.isLight()).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(storage.getItem(STORAGE_KEY.THEME)).toBe('"light"');

    theme.toggle();
    expect(theme.theme()).toBe('dark');
  });

  it('sets a theme explicitly', () => {
    const theme = setup();

    theme.set('light');
    theme.set('dark');

    expect(theme.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(storage.getItem(STORAGE_KEY.THEME)).toBe('"dark"');
  });

  it('restores a stored theme on construction', () => {
    storage.setItem(STORAGE_KEY.THEME, JSON.stringify('light'));

    const theme = setup();

    expect(theme.isLight()).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('ignores an invalid stored value', () => {
    storage.setItem(STORAGE_KEY.THEME, JSON.stringify('neon'));

    const theme = setup();

    expect(theme.theme()).toBe('dark');
  });
});
