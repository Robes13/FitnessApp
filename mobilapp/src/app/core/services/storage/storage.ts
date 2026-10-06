import { DOCUMENT, Injectable, inject } from '@angular/core';
import { STORAGE_KEY_PREFIX, StorageKey } from '../../constants/storage-key';

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

  write<T>(key: StorageKey, value: T): void {
    try {
      this.storage()?.setItem(key, JSON.stringify(value));
    } catch (error: unknown) {
      this.warn('skrive', key, error);
    }
  }

  /**
   * Removes every key the app owns (`STORAGE_KEY_PREFIX`) except `keep` – also keys a later
   * version no longer has in `STORAGE_KEY`, so no old account data survives. Keys from other
   * apps sharing the storage are left alone, so `localStorage.clear()` is deliberately not used.
   */
  clearAll(keep: readonly StorageKey[] = []): void {
    try {
      const storage = this.storage();
      if (!storage) {
        return;
      }
      // Collected first: removing while iterating by index would skip keys.
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      for (const key of keys) {
        if (key?.startsWith(STORAGE_KEY_PREFIX) && !keep.includes(key as StorageKey)) {
          storage.removeItem(key);
        }
      }
    } catch (error: unknown) {
      console.warn('StorageService kunne ikke rydde storage.', error);
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
