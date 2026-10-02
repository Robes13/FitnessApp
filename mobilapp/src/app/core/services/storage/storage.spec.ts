import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../../constants/storage-key';
import { FakeStorage, createFakeDocument, createFakeStorage } from '../../testing/fake-document';
import { StorageService } from './storage';

describe('StorageService', () => {
  let storage: FakeStorage;
  let service: StorageService;

  beforeEach(() => {
    storage = createFakeStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: createFakeDocument(storage) }],
    });
    service = TestBed.inject(StorageService);
  });

  it('round-trips JSON values', () => {
    service.write(STORAGE_KEY.REMINDERS, { username: 'mads', weightKg: 75 });

    expect(service.read<{ username: string }>(STORAGE_KEY.REMINDERS)).toEqual({
      username: 'mads',
      weightKg: 75,
    });
    expect(storage.getItem(STORAGE_KEY.REMINDERS)).toBe('{"username":"mads","weightKg":75}');
  });

  it('returns null for missing keys and after remove', () => {
    expect(service.read(STORAGE_KEY.THEME)).toBeNull();

    service.write(STORAGE_KEY.THEME, 'light');
    service.remove(STORAGE_KEY.THEME);

    expect(service.read(STORAGE_KEY.THEME)).toBeNull();
  });

  it('returns null and warns on corrupt JSON instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storage.setItem(STORAGE_KEY.SESSION, '{not json');

    expect(service.read(STORAGE_KEY.SESSION)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('clears every app key but leaves foreign keys alone', () => {
    for (const key of Object.values(STORAGE_KEY)) {
      service.write(key, 'x');
    }
    storage.setItem('other-app.key', '"keep"');

    service.clearAll();

    expect(Object.values(STORAGE_KEY).map((key) => storage.getItem(key))).toEqual(
      Object.values(STORAGE_KEY).map(() => null),
    );
    expect(storage.getItem('other-app.key')).toBe('"keep"');
  });

  it('keeps the app keys it is told to keep', () => {
    for (const key of Object.values(STORAGE_KEY)) {
      service.write(key, 'x');
    }

    service.clearAll([STORAGE_KEY.THEME, STORAGE_KEY.LANGUAGE]);

    expect(Object.values(STORAGE_KEY).filter((key) => storage.getItem(key) !== null)).toEqual([
      STORAGE_KEY.THEME,
      STORAGE_KEY.LANGUAGE,
    ]);
  });

  it('also clears app keys that STORAGE_KEY no longer lists', () => {
    storage.setItem('nutrify.old', '"legacy"');
    storage.setItem('other.x', '"foreign"');
    service.write(STORAGE_KEY.THEME, 'light');
    service.write(STORAGE_KEY.SESSION, 'x');

    service.clearAll([STORAGE_KEY.THEME]);

    expect([...storage.data.keys()].sort()).toEqual([STORAGE_KEY.THEME, 'other.x']);
  });

  it('degrades to no-ops when storage is unavailable', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { documentElement: {}, defaultView: null } }],
    });
    const detached = TestBed.inject(StorageService);

    expect(() => detached.write(STORAGE_KEY.THEME, 'dark')).not.toThrow();
    expect(detached.read(STORAGE_KEY.THEME)).toBeNull();
    expect(() => detached.remove(STORAGE_KEY.THEME)).not.toThrow();
    expect(() => detached.clearAll()).not.toThrow();
  });
});
