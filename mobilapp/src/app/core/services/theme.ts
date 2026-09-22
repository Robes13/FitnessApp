import { DOCUMENT, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { STORAGE_KEY } from '../constants/storage-key';
import { DEFAULT_THEME, THEME_ATTRIBUTE } from '../constants/theme';
import { Theme } from '../models/theme';
import { StorageService } from './storage';

/**
 * Manuelt tema. Mørk er standard; brugeren slår "Lys tilstand" til i Profil. OS-præferencen
 * følges bevidst ikke (designet er dark-first). Temaet sættes som `data-theme` på `<html>`,
 * som `_tokens.scss` reagerer på, og gemmes i storage.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);
  private readonly state = signal<Theme>(DEFAULT_THEME);

  readonly theme: Signal<Theme> = this.state.asReadonly();
  readonly isLight: Signal<boolean> = computed(() => this.state() === 'light');

  constructor() {
    this.initialize();
  }

  /** Genskaber gemt tema og anvender det på dokumentet. Idempotent – kan kaldes fra en app initializer. */
  initialize(): void {
    const stored = this.storage.read<unknown>(STORAGE_KEY.THEME);
    this.apply(isTheme(stored) ? stored : DEFAULT_THEME);
  }

  set(theme: Theme): void {
    this.apply(theme);
    this.storage.write(STORAGE_KEY.THEME, theme);
  }

  toggle(): void {
    this.set(this.isLight() ? 'dark' : 'light');
  }

  private apply(theme: Theme): void {
    this.state.set(theme);
    this.document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }
}

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}
