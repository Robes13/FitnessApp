import { DOCUMENT, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { STORAGE_KEY } from '../../constants/storage-key';
import { DEFAULT_THEME, THEME_ATTRIBUTE } from '../../constants/theme';
import { Theme } from '../../models/theme';
import { StorageService } from '../storage/storage';

/**
 * Manual theme. Dark is the default; the user turns on "Light mode" in Profile. The OS
 * preference is deliberately not followed (the design is dark-first). The theme is set as
 * `data-theme` on `<html>`, which `_tokens.scss` reacts to, and is saved in storage.
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

  /** Restores the saved theme and applies it to the document. Idempotent – can be called from an app initializer. */
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
