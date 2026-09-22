import { DOCUMENT, Injectable, inject } from '@angular/core';
import { StorageKey } from '../constants/storage-key';

/**
 * Tynd, fejlsikker indpakning af `localStorage` med JSON-serialisering.
 *
 * Kaster aldrig: i private vinduer, ved fuld kvote eller når storage er blokeret, degraderer
 * appen bevidst til ren hukommelses-state i stedet for at gå ned. Fejl logges som advarsel
 * (kun nøglen – aldrig indholdet), så de kan ses under fejlsøgning.
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

  remove(key: StorageKey): void {
    try {
      this.storage()?.removeItem(key);
    } catch (error: unknown) {
      this.warn('slette', key, error);
    }
  }

  private storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      // Adgang til `localStorage` kan i sig selv kaste (blokeret storage). Behandles som "ikke tilgængelig".
      return null;
    }
  }

  private warn(action: string, key: StorageKey, error: unknown): void {
    console.warn(`StorageService kunne ikke ${action} "${key}".`, error);
  }
}
