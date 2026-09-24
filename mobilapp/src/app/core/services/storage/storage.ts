import { DOCUMENT, Injectable, inject } from '@angular/core';
import { STORAGE_KEY, StorageKey } from '../../constants/storage-key';

/**
 * Thin, fail-safe wrapper around `localStorage` with JSON serialization.
 *
 * Never throws: in private windows, when the quota is full, or when storage is blocked,
 * the app deliberately degrades to pure in-memory state instead of crashing. Errors are
 * logged as a warning (only the key – never the content), so they can be seen while debugging.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly document = inject(DOCUMENT);

  read<T>(key: StorageKey): T | null {
    try {
      const raw = this.storage()?.getItem(key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch (error: unknown) {
      this.warn('læse', key, error);
      return null;
    }
  }

  write<T>(key: StorageKey, value: T): boolean {
    try {
      const storage = this.storage();
      if (!storage) {
        return false;
      }
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error: unknown) {
      this.warn('skrive', key, error);
      return false;
    }
  }

  remove(key: StorageKey): void {
    try {
      this.storage()?.removeItem(key);
    } catch (error: unknown) {
      this.warn('slette', key, error);
    }
  }

  /**
   * Removes every key the app owns (`STORAGE_KEY`). Keys from other origins/apps sharing
   * the storage are left alone, so `localStorage.clear()` is deliberately not used.
   */
  clearAll(): void {
    for (const key of Object.values(STORAGE_KEY)) {
      this.remove(key);
    }
  }

  private storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      // Accessing `localStorage` can itself throw (blocked storage). Treated as "not available".
      return null;
    }
  }

  private warn(action: string, key: StorageKey, error: unknown): void {
    console.warn(`StorageService kunne ikke ${action} "${key}".`, error);
  }
}
