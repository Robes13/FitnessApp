import { DOCUMENT, DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { KEYBOARD_CSS, TEXT_ENTRY_SELECTOR } from '../constants/keyboard';
import { KEYBOARD_PLATFORM } from './keyboard-platform';

/**
 * The on-screen keyboard's state, so the layout can make room for it instead of the WebView
 * being pushed.
 *
 * The WebView itself never scrolls or resizes for the keyboard (`ios.scrollEnabled: false` and
 * `Keyboard.resize: 'none'` in `capacitor.config.ts`). Instead this service writes the
 * keyboard's height to `--keyboard-inset` and `data-keyboard="open"` on `<html>`. The app root
 * shrinks by the inset, so every screen – all built on `height: 100%` – lays itself out above
 * the keyboard. When the keyboard has settled, the focused field is scrolled into view inside
 * its own scroll area. A tap outside a text field closes the keyboard (iOS shows no "Done"
 * button in a WebView), while the tap itself still reaches what was tapped.
 *
 * On Android the WebView is already resized by the system, so only the open state is set and
 * the inset stays 0.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardService {
  private readonly document = inject(DOCUMENT);
  private readonly platform = inject(KEYBOARD_PLATFORM);
  private readonly heightState = signal(0);
  private readonly openState = signal(false);

  readonly isOpen: Signal<boolean> = this.openState.asReadonly();
  /** How much the layout has to shrink, in CSS pixels. 0 when the keyboard is closed. */
  readonly inset: Signal<number> = computed(() => (this.openState() ? this.heightState() : 0));

  constructor() {
    if (!this.platform.isAvailable()) {
      return;
    }
    const overlays = this.platform.overlaysContent();
    const stops = [
      this.platform.onWillShow((heightPx) => {
        this.heightState.set(overlays ? heightPx : 0);
        this.openState.set(true);
        this.apply();
      }),
      this.platform.onDidShow(() => this.revealFocusedField()),
      this.platform.onWillHide(() => {
        this.openState.set(false);
        this.apply();
      }),
    ];
    const dismissOnOutsideTap = (event: Event): void => this.dismissUnlessTextEntry(event);
    this.document.addEventListener('pointerdown', dismissOnOutsideTap, true);
    inject(DestroyRef).onDestroy(() => {
      stops.forEach((stop) => stop());
      this.document.removeEventListener('pointerdown', dismissOnOutsideTap, true);
    });
  }

  private apply(): void {
    const root = this.document.documentElement;
    root.style.setProperty(KEYBOARD_CSS.INSET_VARIABLE, `${this.inset()}px`);
    if (this.openState()) {
      root.setAttribute(KEYBOARD_CSS.STATE_ATTRIBUTE, KEYBOARD_CSS.OPEN);
    } else {
      root.removeAttribute(KEYBOARD_CSS.STATE_ATTRIBUTE);
    }
  }

  /** Blurs the focused field – which closes the keyboard – when the tap isn't on a text field. */
  private dismissUnlessTextEntry(event: Event): void {
    if (!this.openState()) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR)) {
      return;
    }
    const focused = this.document.activeElement;
    if (focused instanceof HTMLElement) {
      focused.blur();
    }
  }

  /** Scrolls the focused field into view within its nearest scroll area, if it's covered. */
  private revealFocusedField(): void {
    const focused = this.document.activeElement;
    if (focused instanceof HTMLElement && focused !== this.document.body) {
      focused.scrollIntoView({ block: 'nearest' });
    }
  }
}
