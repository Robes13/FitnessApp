import { DOCUMENT, InjectionToken, inject } from '@angular/core';
import { Capacitor, SystemBars, SystemBarsStyle, registerPlugin } from '@capacitor/core';
import { SystemBarsPlatform, Theme } from '../../models/theme';

/** `Dark` means light icons for a dark app, `Light` dark icons for a light app. */
const STYLE_FOR_THEME: Readonly<Record<Theme, SystemBarsStyle>> = {
  dark: SystemBarsStyle.Dark,
  light: SystemBarsStyle.Light,
};
const PLATFORM_ANDROID = 'android';
/**
 * The page background per theme – what the bars sit on. Palette tokens, because the theme of
 * the bars can differ from `<html>`'s (a photo screen is dark in the light theme too).
 */
const BACKGROUND_TOKEN: Readonly<Record<Theme, string>> = {
  dark: '--palette-background-deep',
  light: '--palette-light-bg',
};

/** The app's own Android plugin (`AppWindowPlugin.java`). */
interface AppWindowPlugin {
  setBackgroundColor(options: { color: string }): Promise<void>;
}
const AppWindow = registerPlugin<AppWindowPlugin>('AppWindow');

/**
 * Capacitor's built-in `SystemBars` plugin on iOS and Android. Does nothing in the browser.
 *
 * On Android the window behind the WebView is coloured too: on WebViews without edge-to-edge
 * support the WebView is inset from the bars, which then sit on the window, not on the page.
 */
export class CapacitorSystemBarsPlatform implements SystemBarsPlatform {
  constructor(private readonly document: Document) {}

  applyTheme(theme: Theme): void {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    SystemBars.setStyle({ style: STYLE_FOR_THEME[theme] })
      // After the style: `setStyle` itself resets the Android window background.
      .then(() =>
        Capacitor.getPlatform() === PLATFORM_ANDROID ? this.colorWindow(theme) : undefined,
      )
      .catch((error: unknown) => {
        // Cosmetic only: the app keeps working with the OS's default bar style.
        console.warn('Could not style the system bars', error);
      });
  }

  private colorWindow(theme: Theme): Promise<void> {
    const view = this.document.defaultView;
    const color = view
      ?.getComputedStyle(this.document.documentElement)
      .getPropertyValue(BACKGROUND_TOKEN[theme])
      .trim();
    return color ? AppWindow.setBackgroundColor({ color }) : Promise.resolve();
  }
}

/** The platform's system bars. Specs provide a fake. */
export const SYSTEM_BARS_PLATFORM = new InjectionToken<SystemBarsPlatform>('SYSTEM_BARS_PLATFORM', {
  providedIn: 'root',
  factory: () => new CapacitorSystemBarsPlatform(inject(DOCUMENT)),
});
