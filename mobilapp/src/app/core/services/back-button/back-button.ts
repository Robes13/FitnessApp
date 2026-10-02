import { DOCUMENT, Injectable, InjectionToken, inject } from '@angular/core';
import { Router, isActive } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { APP_PATH } from '../../constants/app-route';

/** The native back button (Android's button and back gesture). Specs provide a fake. */
export interface BackButtonPlatform {
  /** `canGoBack` is whether the WebView has history to go back to. */
  onBack(listener: (canGoBack: boolean) => void): void;
  /** Sends the app to the background, like Android's own root back. */
  minimize(): void;
}

/** `@capacitor/app` on native platforms; a no-op in the browser (iOS never fires the event). */
class CapacitorBackButtonPlatform implements BackButtonPlatform {
  onBack(listener: (canGoBack: boolean) => void): void {
    if (Capacitor.isNativePlatform()) {
      void App.addListener('backButton', ({ canGoBack }) => listener(canGoBack));
    }
  }

  minimize(): void {
    void App.minimizeApp();
  }
}

export const BACK_BUTTON_PLATFORM = new InjectionToken<BackButtonPlatform>('BACK_BUTTON_PLATFORM', {
  providedIn: 'root',
  factory: () => new CapacitorBackButtonPlatform(),
});

/**
 * The start pages: Home, and login for a guest. The history behind them belongs to an earlier
 * session (log out → log in) or is the way back to them, so back there leaves the app.
 */
const START_PATHS = [APP_PATH.HOME, APP_PATH.LOGIN];

/**
 * Makes back close the topmost sheet or overlay first, then go back in the router, and only
 * leave the app on a start page or when there is nowhere to go back to. Without it Capacitor
 * closes the app on every back press. Sheets and the barcode scanner already close on Escape
 * and mark the event handled, so back is translated to Escape – core stays free of `shared/`
 * imports.
 */
@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private readonly document = inject(DOCUMENT);
  private readonly platform = inject(BACK_BUTTON_PLATFORM);
  private readonly router = inject(Router);
  private readonly onStartPage = START_PATHS.map((path) => isActive(path, this.router));

  constructor() {
    this.platform.onBack((canGoBack) => this.handleBack(canGoBack));
  }

  handleBack(canGoBack: boolean): void {
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    this.document.dispatchEvent(escape);
    if (escape.defaultPrevented) {
      return;
    }
    if (canGoBack && !this.onStartPage.some((active) => active())) {
      this.document.defaultView?.history.back();
      return;
    }
    this.platform.minimize();
  }
}
