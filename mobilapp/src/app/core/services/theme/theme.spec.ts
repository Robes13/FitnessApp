import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../../constants/storage-key';
import {
  FakeDocument,
  FakeStorage,
  createFakeDocument,
  createFakeStorage,
} from '../../testing/fake-document';
import { Theme } from '../../models/theme';
import { SYSTEM_BARS_PLATFORM } from './system-bars-platform';
import { ThemeService } from './theme';

describe('ThemeService', () => {
  let storage: FakeStorage;
  let document: FakeDocument;
  let barThemes: Theme[];

  function setup(): ThemeService {
    document = createFakeDocument(storage);
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: document },
        {
          provide: SYSTEM_BARS_PLATFORM,
          useValue: { applyTheme: (t: Theme) => barThemes.push(t) },
        },
      ],
    });
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
    barThemes = [];
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

  it('styles the native system bars for the applied theme', () => {
    const theme = setup();

    theme.toggle();

    expect(barThemes).toEqual(['dark', 'light']);
  });

  it('holds dark system bars for a photo screen in the light theme until released', () => {
    storage.setItem(STORAGE_KEY.THEME, JSON.stringify('light'));
    const theme = setup();

    const release = theme.holdDarkSystemBars();
    release();
    release();

    expect(barThemes).toEqual(['light', 'dark', 'light']);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
