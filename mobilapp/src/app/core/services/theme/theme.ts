import { DOCUMENT, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { STORAGE_KEY } from '../../constants/storage-key';
import { DEFAULT_THEME, THEME_ATTRIBUTE } from '../../constants/theme';
import { Theme } from '../../models/theme';
import { StorageService } from '../storage/storage';
import { SYSTEM_BARS_PLATFORM } from './system-bars-platform';

/**
 * Manual theme. Dark is the default; the user turns on "Light mode" in Profile. The OS
 * preference is deliberately not followed (the design is dark-first). The theme is set as
 * `data-theme` on `<html>`, which `_tokens.scss` reacts to, and is saved in storage. The native
 * status and navigation bars follow it too, so their icons stay readable in both themes – except
 * while a screen drawn on a dark photo holds them dark (`holdDarkSystemBars`).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);
  private readonly systemBars = inject(SYSTEM_BARS_PLATFORM);
  private readonly state = signal<Theme>(DEFAULT_THEME);
  private readonly darkBarHolds = signal(0);
  /** The system bars' theme: dark while any screen holds them, otherwise the app's theme. */
  private readonly barTheme = computed<Theme>(() =>
    this.darkBarHolds() > 0 ? 'dark' : this.state(),
  );

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

  /**
   * Keeps light bar icons for a screen that is dark in both themes (the photo screens), until the
   * returned function is called. Counted, so two such screens can overlap during navigation.
   */
  holdDarkSystemBars(): () => void {
    this.darkBarHolds.update((holds) => holds + 1);
    this.systemBars.applyTheme(this.barTheme());
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.darkBarHolds.update((holds) => holds - 1);
      this.systemBars.applyTheme(this.barTheme());
    };
  }

  private apply(theme: Theme): void {
    this.state.set(theme);
    this.document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
    this.systemBars.applyTheme(this.barTheme());
  }
}

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}
